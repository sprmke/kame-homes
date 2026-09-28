import type { PhotoSizeMap } from '@/features/dashboard/marketing/lib/poster/posterCompiler';

/**
 * Natural photo sizes for cover-cropping poster photos (browser only). Without
 * them Polotno stretches an image to its frame. Failures resolve to "unknown" so a
 * slow or blocked image never blocks generation; that photo just isn't cropped.
 */

const cache = new Map<string, Promise<{ width: number; height: number } | undefined>>();
const TIMEOUT_MS = 8_000;

function loadSize(url: string): Promise<{ width: number; height: number } | undefined> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = new Promise<{ width: number; height: number } | undefined>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(undefined), TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(
        image.naturalWidth > 0
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : undefined
      );
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      cache.delete(url);
      resolve(undefined);
    };
    image.src = url;
  });
  cache.set(url, pending);
  return pending;
}

export async function loadPosterPhotoSizes(urls: string[]): Promise<PhotoSizeMap> {
  const unique = [...new Set(urls.filter(Boolean))];
  const sizes = await Promise.all(unique.map((url) => loadSize(url)));
  return Object.fromEntries(unique.map((url, index) => [url, sizes[index]]));
}
