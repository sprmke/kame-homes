import { coverCropForFrame } from '@/features/dashboard/marketing/lib/collage/coverCrop';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

/** Center cover-crop so a non-square logo fills a 1×1 frame without letterboxing. */
export function squareImageCoverCrop(
  naturalWidth: number,
  naturalHeight: number
): { cropX: number; cropY: number; cropWidth: number; cropHeight: number } {
  return coverCropForFrame(naturalWidth, naturalHeight, 1, 1);
}

export function loadLogoNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    img.onerror = () => reject(new Error('Could not load logo'));
    img.src = src;
  });
}

type LogoLikeElement = {
  type?: string;
  name?: string;
  src?: string;
  width: number;
  height: number;
  set: (patch: Record<string, unknown>) => void;
};

/**
 * Force every "Org logo" image on the canvas to a 1×1 circle with a center cover crop.
 * Safe to call after `store.waitLoading()`.
 */
export async function polishOrgLogoElements(store: PolotnoStore): Promise<void> {
  const pages = (
    store as {
      pages?: Array<{ children?: LogoLikeElement[] }>;
    }
  ).pages;
  if (!pages?.length) return;

  for (const page of pages) {
    for (const element of page.children ?? []) {
      if (element.type !== 'image' || element.name !== 'Org logo' || !element.src?.trim()) {
        continue;
      }

      const size = Math.max(1, Math.round(Math.min(element.width, element.height)));
      let crop = { cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 };
      try {
        const dims = await loadLogoNaturalSize(element.src);
        crop = squareImageCoverCrop(dims.width, dims.height);
      } catch {
        // Keep full-frame crop; square + radius still fixes the tall original.
      }

      element.set({
        width: size,
        height: size,
        keepRatio: false,
        stretchEnabled: false,
        cornerRadius: size / 2,
        ...crop,
      });
    }
  }
}
