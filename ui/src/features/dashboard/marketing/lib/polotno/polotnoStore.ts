import { createStore } from 'openpolotno/model/store';

import { UPLOAD_MAX_BYTES } from '@/lib/media/uploadLimits';

export type PolotnoStore = ReturnType<typeof createStore>;

/**
 * Export the design as a bounded JPEG (plan §8 / §16 Phase 3) instead of a raw
 * 2× PNG data URL. JPEG q0.92 is visually lossless for full-bleed marketing
 * artwork (photos, gradients, flat colour) while cutting bytes ~4–8×, which
 * keeps the Meta publish payload and any stored copy well under the shared
 * image ceiling. Falls back to 1× if a dense design still lands over the limit.
 */
const EXPORT_QUALITY = 0.92;

export async function exportPolotnoStoreImage(store: PolotnoStore): Promise<Blob> {
  await store.waitLoading();
  let blob = await store.toBlob({
    mimeType: 'image/jpeg',
    quality: EXPORT_QUALITY,
    pixelRatio: 2,
  });
  if (blob && blob.size > UPLOAD_MAX_BYTES.image) {
    const smaller = await store.toBlob({
      mimeType: 'image/jpeg',
      quality: EXPORT_QUALITY,
      pixelRatio: 1,
    });
    if (smaller) blob = smaller;
  }
  if (!blob) throw new Error('Export failed');
  return blob;
}

export function createPolotnoStore(): PolotnoStore {
  const store = createStore({ key: '', showCredit: false });
  store.addPage();
  store.history.clear();
  return store;
}

/**
 * True if any element on the canvas still points at a `blob:` URL — a session
 * upload whose persistent-storage swap hasn't landed yet (in flight, or failed).
 * Exporting one produces a blank frame once the tab closes, so download/publish
 * must refuse instead.
 */
export function hasUnpersistedBlobSources(store: PolotnoStore): boolean {
  const pages = (store as unknown as { pages?: Array<{ children?: Array<{ src?: string }> }> })
    .pages;
  if (!pages?.length) return false;
  for (const page of pages) {
    for (const element of page.children ?? []) {
      if (typeof element.src === 'string' && element.src.startsWith('blob:')) {
        return true;
      }
    }
  }
  return false;
}
