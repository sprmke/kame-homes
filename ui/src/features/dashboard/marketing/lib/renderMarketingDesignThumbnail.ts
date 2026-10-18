import { createStore } from 'openpolotno/model/store';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { blobToDataUrl } from '@/features/dashboard/marketing/lib/exportVideoMedia';
import { ensurePolotnoConfigured } from '@/features/dashboard/marketing/lib/polotno/initPolotno';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { buildPolotnoCampaignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import { syncPolotnoTextBounds } from '@/features/dashboard/marketing/lib/polotno/syncPolotnoTextBounds';

const THUMB_PIXEL_RATIO = 0.2;

async function storeToThumbnailDataUrl(store: PolotnoStore): Promise<string | null> {
  await store.waitLoading();
  const blob = await store.toBlob({
    mimeType: 'image/jpeg',
    pixelRatio: THUMB_PIXEL_RATIO,
  });
  if (!blob || blob.size < 64) return null;
  return blobToDataUrl(blob);
}

let thumbnailPageCounter = 0;

/**
 * OpenPolotno's `toBlob` finds Konva stages by page id. Compiled documents reuse
 * ids like `page-1`, so a headless render could capture the live editor's page
 * instead. Fresh ids per render keep the capture on this document.
 */
function withUniquePageIds<T>(doc: T): T {
  const source = doc as unknown as { pages?: Array<Record<string, unknown>> };
  if (!source?.pages) return doc;
  thumbnailPageCounter += 1;
  return {
    ...source,
    pages: source.pages.map((page, index) => ({
      ...page,
      id: `thumb-${thumbnailPageCounter}-${index}`,
    })),
  } as unknown as T;
}

function createThumbnailStore() {
  ensurePolotnoConfigured();
  return createStore({ key: '', showCredit: false });
}

export async function waitForThumbnailPaint(): Promise<void> {
  await Promise.race([
    document.fonts.ready,
    new Promise<void>((resolve) => window.setTimeout(resolve, 400)),
  ]);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
}

/** Headless preset capture — avoids mounting a second Polotno `<Workspace />`. */
export async function renderDesignPresetThumbnail(
  templateId: string,
  binding: DesignBinding,
  brandColor?: string,
  theme?: MarketingThemeTokens | null
): Promise<string | null> {
  const doc = buildPolotnoCampaignDocument(templateId, binding, {
    brandColor,
    theme: theme ?? undefined,
  });
  if (!doc) return null;

  const store = createThumbnailStore();
  try {
    store.loadJSON(withUniquePageIds(doc));
    store.history.clear();
    await store.waitLoading();
    await syncPolotnoTextBounds(store);
    await waitForThumbnailPaint();
    return await storeToThumbnailDataUrl(store);
  } catch {
    return null;
  } finally {
    (store as { destroy?: () => void }).destroy?.();
  }
}

/** Headless capture of any saved Polotno document (e.g. a saved post re-themed). */
export async function renderDesignDocumentThumbnail(doc: unknown): Promise<string | null> {
  if (!doc || typeof doc !== 'object') return null;
  const store = createThumbnailStore();
  try {
    store.loadJSON(withUniquePageIds(doc) as Record<string, unknown>);
    store.history.clear();
    await store.waitLoading();
    await syncPolotnoTextBounds(store);
    await waitForThumbnailPaint();
    return await storeToThumbnailDataUrl(store);
  } catch {
    return null;
  } finally {
    (store as { destroy?: () => void }).destroy?.();
  }
}

export async function renderDesignStoreThumbnail(store: PolotnoStore): Promise<string | null> {
  try {
    return await storeToThumbnailDataUrl(store);
  } catch {
    return null;
  }
}
