import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

/**
 * Document-level collage state, stored at `store.custom.collage` so it round-trips
 * through `store.toJSON()` / `loadJSON()` with zero schema change. A design is a
 * collage iff `store.custom?.collage` is present.
 */
export type CollageSettings = {
  version: 1;
  layoutId: string;
  gap: number; // px between cells, at document scale
  outerPadding: number; // px frame around the whole collage
  cornerRadius: number; // px, applied per cell
  borderSize: number; // px, 0 = none
  borderColor: string;
  backgroundColor: string;
};

export const COLLAGE_SETTINGS_DEFAULTS: Omit<CollageSettings, 'version' | 'layoutId'> = {
  gap: 12,
  outerPadding: 0,
  cornerRadius: 0,
  borderSize: 0,
  borderColor: '#ffffff',
  backgroundColor: '#ffffff',
};

/** Marks a Polotno image element as a collage cell; lives on `element.custom`. */
export type CollageCellRef = {
  collageCellId: string;
};

export type CollageCellFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** One collage cell as seen by the UI/store-ops layer. */
export type CollageCellState = {
  cellId: string;
  frame: CollageCellFrame;
  src: string | null;
  elementId: string | null;
};

export function isCollageDocument(storeCustom: unknown): boolean {
  if (!storeCustom || typeof storeCustom !== 'object') return false;
  return Boolean((storeCustom as { collage?: unknown }).collage);
}

export function readCollageCellRef(elementCustom: unknown): CollageCellRef | null {
  if (!elementCustom || typeof elementCustom !== 'object') return null;
  const collageCellId = (elementCustom as { collageCellId?: unknown }).collageCellId;
  return typeof collageCellId === 'string' && collageCellId ? { collageCellId } : null;
}

export type CollageStartFrom = 'templates' | 'collage' | 'blank';

/** Sort/filter hint only — every layout works in every format, per the plan. */
export type CollageBestForHint = DesignTemplateFormat;
