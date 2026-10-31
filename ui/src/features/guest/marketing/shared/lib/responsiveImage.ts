/**
 * `srcset` for listing photos so phones do not download desktop-size originals.
 *
 * - Supabase Storage public objects → Storage image transformation endpoint
 *   (`/storage/v1/render/image/public/...?width=`). Opt-in via
 *   `VITE_SUPABASE_IMAGE_TRANSFORMS=true` because transforms need a plan that enables them;
 *   without the flag the original URL is used unchanged.
 * - Unsplash (placeholder / seed photos) → its `w=` query param.
 * - Anything else → no srcset (served as-is).
 */

export const RESPONSIVE_IMAGE_WIDTHS = [320, 480, 640, 960, 1280] as const;

/** Default `sizes` for listing card images (grid cells, not full-bleed). */
export const DEFAULT_CARD_IMAGE_SIZES =
  '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw';

const STORAGE_PUBLIC_MARKER = '/storage/v1/object/public/';
const STORAGE_RENDER_MARKER = '/storage/v1/render/image/public/';

export type ResponsiveImage = { src: string; srcSet: string };

function withParam(url: URL, key: string, value: string): string {
  const next = new URL(url.toString());
  next.searchParams.set(key, value);
  return next.toString();
}

export function buildResponsiveImage(
  src: string,
  options: { storageTransforms: boolean; widths?: readonly number[] }
): ResponsiveImage | null {
  const widths = options.widths ?? RESPONSIVE_IMAGE_WIDTHS;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  if (options.storageTransforms && url.pathname.includes(STORAGE_PUBLIC_MARKER)) {
    const render = new URL(url.toString());
    render.pathname = url.pathname.replace(STORAGE_PUBLIC_MARKER, STORAGE_RENDER_MARKER);
    render.searchParams.set('resize', 'cover');
    render.searchParams.set('quality', '75');
    const srcSet = widths.map((w) => `${withParam(render, 'width', String(w))} ${w}w`).join(', ');
    return { src: withParam(render, 'width', String(widths[widths.length - 1])), srcSet };
  }

  if (url.hostname === 'images.unsplash.com') {
    const srcSet = widths
      .map((w) => `${withParam(url, 'w', String(w))} ${w}w`)
      .join(', ');
    return { src: withParam(url, 'w', String(widths[widths.length - 1])), srcSet };
  }

  return null;
}

export function storageTransformsEnabled(): boolean {
  return import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORMS === 'true';
}
