/**
 * Pure collage geometry + document-building functions. No React, no Polotno
 * import — fully testable under the repo's Node-env Vitest. The only file
 * that touches the live MST store is `collageStoreOps.ts`.
 */
import type { CollageLayout } from '@/features/dashboard/marketing/lib/collage/collageLayouts';
import { DEFAULT_COLLAGE_LAYOUT_ID } from '@/features/dashboard/marketing/lib/collage/collageLayouts';
import {
  COLLAGE_SETTINGS_DEFAULTS,
  type CollageCellFrame,
  type CollageCellState,
  type CollageSettings,
} from '@/features/dashboard/marketing/lib/collage/collageTypes';
import type { PolotnoChild } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import {
  DESIGN_FORMAT_DIMENSIONS,
  type DesignTemplateFormat,
} from '@/features/dashboard/marketing/lib/templateRegistry';

export type CollagePolotnoDocument = {
  width: number;
  height: number;
  schemaVersion: number;
  fonts: unknown[];
  pages: Array<{ id: string; background: string; children: PolotnoChild[] }>;
  custom: { collage: CollageSettings };
};

export type CollagePhotoInput = { url: string } | null;

/** Cell frame geometry, in px, for a layout + settings at a given canvas size. */
export function collageFrames(
  layout: CollageLayout,
  settings: CollageSettings,
  width: number,
  height: number
): CollageCellFrame[] {
  const innerW = Math.max(0, width - settings.outerPadding * 2);
  const innerH = Math.max(0, height - settings.outerPadding * 2);
  const halfGap = settings.gap / 2;

  return layout.cells.map((cell) => {
    const rawX = settings.outerPadding + cell.xr * innerW;
    const rawY = settings.outerPadding + cell.yr * innerH;
    const rawW = cell.wr * innerW;
    const rawH = cell.hr * innerH;
    return {
      x: Math.round(rawX + halfGap),
      y: Math.round(rawY + halfGap),
      width: Math.max(1, Math.round(rawW - settings.gap)),
      height: Math.max(1, Math.round(rawH - settings.gap)),
    };
  });
}

export function collageCellId(index: number): string {
  return `cell-${index + 1}`;
}

/** Inverse of `collageCellId` — parses the 0-based cell index back out, or -1. */
export function collageCellIndex(cellId: string): number {
  const match = /^cell-(\d+)$/.exec(cellId);
  return match ? Number(match[1]) - 1 : -1;
}

export const EMPTY_COLLAGE_CELL_NAME = 'Collage cell (empty)';
export const FILLED_COLLAGE_CELL_NAME = 'Collage cell';

/**
 * Empty-cell placeholder as an SVG data URI sized to the cell's own frame, so the
 * image's natural aspect always matches the element and never stretches or clips.
 * Quiet by design: a flat tint, a small "+" badge and the cell number.
 */
export function emptyCollageCellSvgDataUri(
  cellNumber: number,
  width: number,
  height: number
): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const short = Math.min(w, h);
  const badge = Math.min(72, Math.max(28, Math.round(short * 0.2)));
  const r = badge / 2;
  const cx = w / 2;
  const cy = h / 2;
  const arm = badge * 0.2;
  const stroke = Math.max(2, badge * 0.07);
  const label = Math.min(26, Math.max(12, Math.round(short * 0.06)));
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" fill="#eef1ef"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#d3dad6" stroke-width="${stroke / 2}"/>`,
    `<path d="M${cx - arm} ${cy}H${cx + arm}M${cx} ${cy - arm}V${cy + arm}" stroke="#3f4a46" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>`,
    `<text x="${cx}" y="${cy + r + label * 1.7}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${label}" fill="#8a948f">${cellNumber}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function collageCellElement(
  index: number,
  frame: CollageCellFrame,
  photo: CollagePhotoInput,
  settings: CollageSettings
): PolotnoChild {
  const cellId = collageCellId(index);
  const empty = !photo?.url;
  return {
    id: cellId,
    type: 'image',
    name: empty ? EMPTY_COLLAGE_CELL_NAME : FILLED_COLLAGE_CELL_NAME,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    src: empty
      ? emptyCollageCellSvgDataUri(index + 1, frame.width, frame.height)
      : photo!.url,
    cropX: 0,
    cropY: 0,
    cropWidth: 1,
    cropHeight: 1,
    cornerRadius: settings.cornerRadius,
    borderColor: settings.borderColor,
    borderSize: settings.borderSize,
    keepRatio: false,
    stretchEnabled: false,
    locked: false,
    selectable: true,
    custom: { collageCellId: cellId },
  };
}

export function resolveCollageSettings(patch?: Partial<CollageSettings>): CollageSettings {
  return {
    version: 1,
    layoutId: patch?.layoutId ?? DEFAULT_COLLAGE_LAYOUT_ID,
    gap: patch?.gap ?? COLLAGE_SETTINGS_DEFAULTS.gap,
    outerPadding: patch?.outerPadding ?? COLLAGE_SETTINGS_DEFAULTS.outerPadding,
    cornerRadius: patch?.cornerRadius ?? COLLAGE_SETTINGS_DEFAULTS.cornerRadius,
    borderSize: patch?.borderSize ?? COLLAGE_SETTINGS_DEFAULTS.borderSize,
    borderColor: patch?.borderColor ?? COLLAGE_SETTINGS_DEFAULTS.borderColor,
    backgroundColor: patch?.backgroundColor ?? COLLAGE_SETTINGS_DEFAULTS.backgroundColor,
  };
}

/** Builds a full document from scratch — layout + photos (in cell order) + style. */
export function buildCollageDocument(
  layout: CollageLayout,
  photos: CollagePhotoInput[],
  settings: CollageSettings,
  format: DesignTemplateFormat
): CollagePolotnoDocument {
  const { width, height } = DESIGN_FORMAT_DIMENSIONS[format];
  const frames = collageFrames(layout, settings, width, height);
  const resolvedSettings: CollageSettings = { ...settings, layoutId: layout.id };

  const children = frames.map((frame, index) =>
    collageCellElement(index, frame, photos[index] ?? null, resolvedSettings)
  );

  return {
    width,
    height,
    schemaVersion: 2,
    fonts: [],
    custom: { collage: resolvedSettings },
    pages: [
      {
        id: `collage-${layout.id}`,
        background: resolvedSettings.backgroundColor,
        children,
      },
    ],
  };
}

/** Reads `custom.collage` off a serialized store JSON (or a bare `custom` object). */
export function readCollageSettings(source: unknown): CollageSettings | null {
  if (!source || typeof source !== 'object') return null;
  const maybeCustom = (source as { custom?: unknown }).custom;
  const custom = maybeCustom && typeof maybeCustom === 'object' ? maybeCustom : source;
  const collage = (custom as { collage?: unknown }).collage;
  if (!collage || typeof collage !== 'object') return null;

  const c = collage as Partial<CollageSettings>;
  if (typeof c.layoutId !== 'string' || !c.layoutId) return null;

  return resolveCollageSettings(c);
}

/** Merges a settings patch into an existing `store.custom` object, immutably. */
export function withCollageSettings(
  storeCustom: Record<string, unknown> | undefined,
  patch: Partial<CollageSettings>
): Record<string, unknown> {
  const current = readCollageSettings(storeCustom) ?? undefined;
  return {
    ...storeCustom,
    collage: resolveCollageSettings({ ...current, ...patch }),
  };
}

/**
 * Diffs the current cells against a new layout, ordinally: cell N of the next
 * layout inherits the src of cell N of the current one (if any); extra current
 * cells beyond the new layout's count are dropped; extra new cells start empty.
 * Preserves photo order — never reshuffles srcs across positions.
 */
export function planRelayout(
  currentCells: CollageCellState[],
  nextLayout: CollageLayout,
  settings: CollageSettings,
  width: number,
  height: number
): CollageCellState[] {
  const resolvedSettings: CollageSettings = { ...settings, layoutId: nextLayout.id };
  const frames = collageFrames(nextLayout, resolvedSettings, width, height);
  return frames.map((frame, index) => ({
    cellId: collageCellId(index),
    frame,
    src: currentCells[index]?.src ?? null,
    elementId: null,
  }));
}
