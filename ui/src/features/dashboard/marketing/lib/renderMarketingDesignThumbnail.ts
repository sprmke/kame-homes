import { createElement } from 'react';

import { createRoot } from 'react-dom/client';

import Workspace from 'openpolotno/canvas/workspace';
import { createStore } from 'openpolotno/model/store';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { blobToDataUrl } from '@/features/dashboard/marketing/lib/exportVideoMedia';
import { savedThumbnailPixelRatio } from '@/features/dashboard/marketing/lib/marketingThumbSizing';
import { ensurePolotnoConfigured } from '@/features/dashboard/marketing/lib/polotno/initPolotno';
import { buildPolotnoCampaignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import { syncPolotnoTextBounds } from '@/features/dashboard/marketing/lib/polotno/syncPolotnoTextBounds';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';

/** Card art for template tiles (~180px CSS wide at 2x). */
const CARD_THUMB_LONG_EDGE = 360;

async function storeToThumbnailDataUrl(store: PolotnoStore): Promise<string | null> {
  await store.waitLoading();
  const size = store as unknown as { width: number; height: number };
  const blob = await store.toBlob({
    mimeType: 'image/jpeg',
    pixelRatio: savedThumbnailPixelRatio(size.width, size.height, CARD_THUMB_LONG_EDGE),
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

/**
 * OpenPolotno can only export a page whose `<Workspace />` is mounted (it looks the
 * Konva stage up by page id). Off-screen renders mount a hidden, inert workspace for
 * the length of the capture.
 */
function mountOffscreenWorkspace(store: unknown, width: number, height: number): () => void {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    `width:${Math.max(64, Math.round(width / 4))}px`,
    `height:${Math.max(64, Math.round(height / 4))}px`,
    'opacity:0',
    'pointer-events:none',
    'overflow:hidden',
    'contain:strict',
  ].join(';');
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(Workspace as never, { store } as never));
  return () => {
    root.unmount();
    host.remove();
  };
}

/** Runs `task` with `store` mounted off-screen, then tears the mount down. */
async function withOffscreenWorkspace<T>(store: unknown, task: () => Promise<T>): Promise<T> {
  const size = store as { width?: number; height?: number };
  const dispose = mountOffscreenWorkspace(store, size.width ?? 1080, size.height ?? 1080);
  try {
    return await task();
  } finally {
    dispose();
  }
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

/** Off-screen preset capture (hidden workspace, never the live editor's). */
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
    return await withOffscreenWorkspace(store, async () => {
      await waitForThumbnailPaint();
      return storeToThumbnailDataUrl(store);
    });
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
    return await withOffscreenWorkspace(store, async () => {
      await waitForThumbnailPaint();
      return storeToThumbnailDataUrl(store);
    });
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

/** Stored (Library) thumbnail of the live editor canvas. */
export async function renderDesignStoreSavedThumbnail(
  store: PolotnoStore
): Promise<string | null> {
  try {
    await store.waitLoading();
    const size = store as unknown as { width: number; height: number };
    const blob = await store.toBlob({
      mimeType: 'image/jpeg',
      pixelRatio: savedThumbnailPixelRatio(size.width, size.height),
    });
    if (!blob || blob.size < 64) return null;
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * The same design at another size, built off-screen (the open canvas is untouched).
 * Elements scale and move with the page ("magic" resize); a thumbnail comes along.
 */
export async function resizeDesignDocument(
  doc: Record<string, unknown>,
  width: number,
  height: number,
  relayout?: (store: PolotnoStore) => Promise<void>
): Promise<{ document: Record<string, unknown>; thumbnail: string | null } | null> {
  const store = createThumbnailStore();
  try {
    store.loadJSON(withUniquePageIds(doc));
    store.history.clear();
    await store.waitLoading();
    (store as unknown as { setSize: (w: number, h: number, magic?: boolean) => void }).setSize(
      width,
      height,
      true
    );
    if (relayout) await relayout(store as unknown as PolotnoStore);
    await syncPolotnoTextBounds(store as unknown as PolotnoStore);
    const document = store.toJSON() as Record<string, unknown>;
    // The resized document is the result; a failed thumbnail must not lose it.
    const thumbnail = await withOffscreenWorkspace(store, async () => {
      await waitForThumbnailPaint();
      const blob = await store.toBlob({
        mimeType: 'image/jpeg',
        pixelRatio: savedThumbnailPixelRatio(width, height),
      });
      return blob && blob.size >= 64 ? blobToDataUrl(blob) : null;
    }).catch(() => null);
    return { document, thumbnail };
  } catch {
    return null;
  } finally {
    (store as { destroy?: () => void }).destroy?.();
  }
}
