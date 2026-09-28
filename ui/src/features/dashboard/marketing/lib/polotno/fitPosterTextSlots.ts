import Konva from 'konva';

import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import type { PosterSlotMeta } from '@/features/dashboard/marketing/lib/poster/posterModules';

type SlotChild = {
  id: string;
  type: string;
  y: number;
  fontSize: number;
  height: number;
  custom?: { posterSlot?: PosterSlotMeta };
  set: (patch: Record<string, unknown>) => void;
};

/** Two frames, or 120ms when the tab is throttled (background tabs pause rAF). */
export async function posterSettle(): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }),
    new Promise<void>((resolve) => window.setTimeout(resolve, 120)),
  ]);
}

const MAX_ROUNDS = 8;

/**
 * Real-metric pass for compiled posters. The compiler sizes copy from estimated
 * glyph widths; once fonts are loaded, any slot whose rendered text is taller than
 * its budget (an extra wrapped line) shrinks ~6% per round until it fits or hits
 * its floor. Bottom-anchored slots keep their bottom edge.
 */
export async function fitPosterTextSlots(store: PolotnoStore): Promise<void> {
  await store.waitLoading();
  await Promise.race([
    document.fonts?.ready,
    new Promise((resolve) => window.setTimeout(resolve, 2_000)),
  ]);
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    await posterSettle();
    let changed = false;
    for (const page of store.pages ?? []) {
      const stage = Konva.stages.find((candidate) => candidate.getAttr('pageId') === page.id);
      if (!stage) continue;
      for (const child of page.children as SlotChild[]) {
        const slot = child.custom?.posterSlot;
        if (child.type !== 'text' || !slot) continue;
        const node = stage.findOne(`#${child.id}`) as Konva.Text | null;
        if (!node) continue;
        const measured = node.getHeight();
        if (measured <= slot.maxHeight * 1.03 || child.fontSize <= slot.minFontSize) continue;
        const fontSize = Math.max(slot.minFontSize, Math.floor(child.fontSize * 0.94));
        const bottom = child.y + child.height;
        const height = Math.round((child.height * fontSize) / child.fontSize);
        child.set({
          fontSize,
          height,
          ...(slot.anchor === 'bottom' ? { y: bottom - height } : {}),
        });
        changed = true;
      }
    }
    if (!changed) return;
  }
}
