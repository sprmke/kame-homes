import Konva from 'konva';

import {
  fitPosterTextSlots,
  posterSettle,
} from '@/features/dashboard/marketing/lib/polotno/fitPosterTextSlots';
import { ensurePolotnoConfigured } from '@/features/dashboard/marketing/lib/polotno/initPolotno';
import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

/**
 * Renders compiled posters to images outside the Design editor (Generate tab
 * results). OpenPolotno can only export from a mounted <Workspace />, so one hidden,
 * off-screen workspace is created on first use and reused; renders are queued so
 * variants never race on the shared store.
 */

let storePromise: Promise<PolotnoStore> | null = null;

/** The workspace mounts a Konva stage per page asynchronously; export needs it. */
async function waitForPageStage(store: PolotnoStore, timeoutMs = 4_000): Promise<void> {
  const pageId = (store.pages?.[0] as { id?: string } | undefined)?.id;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pageId && Konva.stages.some((stage) => stage.getAttr('pageId') === pageId)) return;
    await posterSettle();
  }
}
let queue: Promise<unknown> = Promise.resolve();

function getRenderStore(): Promise<PolotnoStore> {
  storePromise ??= (async () => {
    const [{ createStore }, { default: Workspace }, { createRoot }, { createElement }] =
      await Promise.all([
        import('openpolotno/model/store'),
        import('openpolotno/canvas/workspace'),
        import('react-dom/client'),
        import('react'),
      ]);
    ensurePolotnoConfigured();
    const store = createStore({ key: '', showCredit: false });
    store.addPage();
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1200px;height:900px;pointer-events:none;';
    document.body.appendChild(host);
    createRoot(host).render(createElement(Workspace, { store: store as never }));
    await posterSettle();
    return store as PolotnoStore;
  })();
  return storePromise;
}

export type RenderedPoster = {
  dataUrl: string;
  /** Document after real-metric text fitting; save this one so edits start fitted. */
  document: PolotnoDesignDocument;
};

export function renderPosterDocument(
  document: PolotnoDesignDocument,
  options?: { pixelRatio?: number; mimeType?: 'image/jpeg' | 'image/png' }
): Promise<RenderedPoster> {
  const run = async (): Promise<RenderedPoster> => {
    const store = await getRenderStore();
    store.loadJSON(document);
    store.history.clear();
    await waitForPageStage(store);
    await store.waitLoading();
    await fitPosterTextSlots(store);
    await posterSettle();
    await store.waitLoading();
    const dataUrl = await (
      store as unknown as {
        toDataURL: (opts: Record<string, unknown>) => Promise<string>;
      }
    ).toDataURL({
      pixelRatio: options?.pixelRatio ?? 0.5,
      mimeType: options?.mimeType ?? 'image/jpeg',
      quality: 0.9,
    });
    return { dataUrl, document: store.toJSON() as PolotnoDesignDocument };
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}
