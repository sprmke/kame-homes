import Konva from 'konva';

import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

type PolotnoPageChild = {
  id: string;
  type: string;
  height?: number;
  fontSize?: number;
  set: (patch: Record<string, unknown>) => void;
};

/** Wait for Konva layout + fonts before measuring text nodes. */
async function waitForCanvasLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Persist Konva text box sizes into the store so hover bounds and exports match the canvas.
 * Auto-height text often keeps height 0 (or 1) in the model until measured.
 */
export async function syncPolotnoTextBounds(store: PolotnoStore): Promise<void> {
  await store.waitLoading();
  await waitForCanvasLayout();

  for (const page of store.pages ?? []) {
    const stage = Konva.stages.find((candidate) => candidate.getAttr('pageId') === page.id);
    if (!stage) continue;

    for (const child of page.children as PolotnoPageChild[]) {
      if (child.type !== 'text') continue;

      const node = stage.findOne(`#${child.id}`) as Konva.Text | null;
      if (!node) continue;

      const measuredHeight =
        typeof node.getHeight === 'function' ? node.getHeight() : node.height();
      const measuredWidth = node.width();
      const minExpected = (child.fontSize ?? 14) * 0.75;
      const storedHeight = child.height ?? 0;
      const maxExpected = (child.fontSize ?? 14) * 4;

      if (measuredHeight < minExpected) continue;
      if (measuredHeight > maxExpected) continue;

      if (storedHeight <= 1 || Math.abs(storedHeight - measuredHeight) > 1) {
        child.set({
          height: Math.min(measuredHeight, maxExpected),
          width: measuredWidth,
        });
      }
    }
  }
}
