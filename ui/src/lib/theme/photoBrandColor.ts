import { generateShowcaseMediaPalette } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';

type PhotoMedia = { url: string; type: string };

/** Up to 10 image URLs from property gallery media (skips videos). */
export function collectPropertyPhotoUrls(media: PhotoMedia[]): string[] {
  return [
    ...new Set(
      media.filter((item) => item.type === 'image' && item.url.trim()).map((item) => item.url)
    ),
  ].slice(0, 10);
}

/** Client-side accent extraction from property photos — reuses showcase media palette logic. */
export async function extractBrandAccentFromPhotos(urls: string[]): Promise<string | null> {
  const palette = await generateShowcaseMediaPalette(urls);
  return palette?.accentHexLight ?? null;
}
