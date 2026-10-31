/**
 * The only file that touches the live Polotno (mobx-state-tree) store for the
 * collage feature. Every mutation here runs inside `store.history.transaction()`
 * (Polotno's own async-aware undo boundary) so a 9-cell relayout — including the
 * awaited cover-crop refinement — is one undo step, not nine.
 */
import {
  buildCollageDocument,
  collageCellElement,
  collageCellId,
  collageCellIndex,
  collageFrames,
  EMPTY_COLLAGE_CELL_NAME,
  emptyCollageCellSvgDataUri,
  FILLED_COLLAGE_CELL_NAME,
  planRelayout,
  readCollageSettings,
  resolveCollageSettings,
  withCollageSettings,
} from '@/features/dashboard/marketing/lib/collage/collageDocument';
import {
  DEFAULT_COLLAGE_LAYOUT_ID,
  getCollageLayout,
} from '@/features/dashboard/marketing/lib/collage/collageLayouts';
import {
  readCollageCellRef,
  type CollageCellState,
  type CollageSettings,
} from '@/features/dashboard/marketing/lib/collage/collageTypes';
import { coverCropForFrame } from '@/features/dashboard/marketing/lib/collage/coverCrop';
import { loadLogoNaturalSize } from '@/features/dashboard/marketing/lib/polotno/orgLogoCircle';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import {
  DESIGN_FORMAT_DIMENSIONS,
  type DesignTemplateFormat,
} from '@/features/dashboard/marketing/lib/templateRegistry';

type CollageElementLike = {
  id: string;
  name?: string;
  src?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  custom?: unknown;
  set: (patch: Record<string, unknown>) => void;
  toggleCropMode: (value?: boolean) => void;
};

type CollagePageLike = {
  width: number | 'auto';
  height: number | 'auto';
  background?: string;
  children: CollageElementLike[];
  set: (patch: Record<string, unknown>) => void;
  addElement: (
    attrs: Record<string, unknown>,
    options?: { skipSelect?: boolean }
  ) => CollageElementLike;
};

type CollageStoreLike = {
  width?: number | 'auto';
  height?: number | 'auto';
  activePage?: CollagePageLike;
  custom?: unknown;
  selectedElementsIds?: string[];
  history: {
    transaction: (fn: () => void | Promise<void>) => Promise<void>;
  };
  set: (patch: Record<string, unknown>) => void;
  toJSON: () => unknown;
  deleteElements: (ids: string[]) => void;
  selectElements: (ids: string[]) => void;
};

function asCollageStore(store: PolotnoStore): CollageStoreLike {
  return store as unknown as CollageStoreLike;
}

/** Canvas size: the page's own size, else the store's (pages are usually `auto`). */
function pageDimensions(
  store: CollageStoreLike,
  format?: DesignTemplateFormat
): { width: number; height: number } {
  const fallback = DESIGN_FORMAT_DIMENSIONS[format ?? 'instagram-post'];
  const page = store.activePage;
  const pick = (own: number | 'auto' | undefined, shared: number | 'auto' | undefined, d: number) =>
    typeof own === 'number' ? own : typeof shared === 'number' ? shared : d;
  return {
    width: pick(page?.width, store.width, fallback.width),
    height: pick(page?.height, store.height, fallback.height),
  };
}

function collageCellElements(
  page: CollagePageLike | undefined
): Array<{ index: number; element: CollageElementLike }> {
  if (!page) return [];
  const found: Array<{ index: number; element: CollageElementLike }> = [];
  for (const element of page.children) {
    const ref = readCollageCellRef(element.custom);
    if (!ref) continue;
    const index = collageCellIndex(ref.collageCellId);
    if (index < 0) continue;
    found.push({ index, element });
  }
  return found.sort((a, b) => a.index - b.index);
}

function currentCollageCells(page: CollagePageLike | undefined): CollageCellState[] {
  const cells: CollageCellState[] = [];
  for (const { index, element } of collageCellElements(page)) {
    cells[index] = {
      cellId: collageCellId(index),
      frame: { x: element.x, y: element.y, width: element.width, height: element.height },
      src: element.name === EMPTY_COLLAGE_CELL_NAME ? null : (element.src ?? null),
      elementId: element.id,
    };
  }
  return cells;
}

/**
 * Reads `store.custom` (an observable prop) rather than `store.toJSON()` so mobx
 * observers (the layout grid's selected state) re-render when the layout changes.
 */
function currentSettings(store: CollageStoreLike): CollageSettings {
  return readCollageSettings(store.custom) ?? resolveCollageSettings();
}

/** True when the active page's canvas is a collage document. */
export function isStoreInCollageMode(store: PolotnoStore): boolean {
  return readCollageSettings(asCollageStore(store).custom) != null;
}

/** Current collage settings, or the defaults if the store isn't a collage yet. */
export function getCollageSettings(store: PolotnoStore): CollageSettings {
  return currentSettings(asCollageStore(store));
}

/** Read-only snapshot of every collage cell on the active page, in cell order. */
export function getCollageCells(store: PolotnoStore): CollageCellState[] {
  return currentCollageCells(asCollageStore(store).activePage);
}

/** The collage cell id currently selected on canvas, if any. */
export function getSelectedCollageCellId(store: PolotnoStore): string | null {
  const s = asCollageStore(store);
  const selectedIds = s.selectedElementsIds ?? [];
  const page = s.activePage;
  const entries = collageCellElements(page);
  const selected = entries.find(({ element }) => selectedIds.includes(element.id));
  return selected ? collageCellId(selected.index) : null;
}

function setStoreCollageSettings(store: CollageStoreLike, settings: CollageSettings): void {
  store.set({
    custom: withCollageSettings(store.custom as Record<string, unknown> | undefined, settings),
  });
}

const naturalSizeCache = new Map<string, { width: number; height: number }>();

async function naturalSizeFor(url: string): Promise<{ width: number; height: number } | null> {
  if (url.startsWith('data:')) return null;
  const cached = naturalSizeCache.get(url);
  if (cached) return cached;
  try {
    const size = await loadLogoNaturalSize(url);
    naturalSizeCache.set(url, size);
    return size;
  } catch {
    return null;
  }
}

/** Recomputes cover-crop for filled cells against their current frame size. */
async function refineCellCrops(
  page: CollagePageLike | undefined,
  onlyCellIds?: Set<string>
): Promise<void> {
  const entries = collageCellElements(page).filter(
    ({ index }) => !onlyCellIds || onlyCellIds.has(collageCellId(index))
  );
  for (const { element } of entries) {
    if (element.name === EMPTY_COLLAGE_CELL_NAME || !element.src) continue;
    const size = await naturalSizeFor(element.src);
    if (!size) continue;
    const crop = coverCropForFrame(size.width, size.height, element.width, element.height);
    element.set(crop);
  }
}

/** Starts a brand-new collage document (used the first time "Start from → Collage" runs). */
export function startCollageDocument(
  store: PolotnoStore,
  layoutId: string,
  format: DesignTemplateFormat
): void {
  const layout = getCollageLayout(layoutId) ?? getCollageLayout(DEFAULT_COLLAGE_LAYOUT_ID)!;
  const settings = resolveCollageSettings({ layoutId: layout.id });
  const doc = buildCollageDocument(layout, [], settings, format);
  const loadable = store as unknown as {
    loadJSON: (json: unknown) => void;
    history: { clear: () => void };
  };
  loadable.loadJSON(doc);
  loadable.history.clear();
}

/**
 * Relays out the canvas for `layoutId`, preserving existing cell photos by position.
 * Cells are reshaped in place (never deleted and re-added under the same id, which
 * trips mobx-state-tree); only the surplus is removed and the shortfall appended.
 */
export async function applyCollageLayout(store: PolotnoStore, layoutId: string): Promise<void> {
  const layout = getCollageLayout(layoutId);
  if (!layout) return;
  const s = asCollageStore(store);
  const page = s.activePage;
  if (!page) return;
  const { width, height } = pageDimensions(s);
  const settings = resolveCollageSettings({ ...currentSettings(s), layoutId });
  const existing = collageCellElements(page);
  const nextCells = planRelayout(currentCollageCells(page), layout, settings, width, height);

  await s.history.transaction(async () => {
    const surplus = existing.filter(({ index }) => index >= nextCells.length);
    if (surplus.length) s.deleteElements(surplus.map(({ element }) => element.id));

    nextCells.forEach((cell, index) => {
      const entry = existing.find((e) => e.index === index);
      if (entry) {
        entry.element.set({
          x: cell.frame.x,
          y: cell.frame.y,
          width: cell.frame.width,
          height: cell.frame.height,
          cornerRadius: settings.cornerRadius,
          borderColor: settings.borderColor,
          borderSize: settings.borderSize,
          ...(cell.src ? {} : { src: emptyCollageCellPlaceholderSrc(index, cell.frame) }),
        });
        return;
      }
      const { id: _id, ...attrs } = collageCellElement(
        index,
        cell.frame,
        cell.src ? { url: cell.src } : null,
        settings
      );
      page.addElement(attrs, { skipSelect: true });
    });
    page.set({ background: settings.backgroundColor });
    setStoreCollageSettings(s, settings);
    await refineCellCrops(page);
  });
}

/** Gap / corner radius / outer padding / border / background — debounced by the caller. */
export async function applyCollageStyle(
  store: PolotnoStore,
  patch: Partial<CollageSettings>
): Promise<void> {
  const s = asCollageStore(store);
  const page = s.activePage;
  const settings = resolveCollageSettings({ ...currentSettings(s), ...patch });
  const layout = getCollageLayout(settings.layoutId);
  if (!layout) return;
  const { width, height } = pageDimensions(s);
  const frames = collageFrames(layout, settings, width, height);
  const entries = collageCellElements(page);
  const gapChanged = patch.gap != null || patch.outerPadding != null;

  await s.history.transaction(async () => {
    entries.forEach(({ index, element }) => {
      const frame = frames[index];
      if (!frame) return;
      element.set({
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        cornerRadius: settings.cornerRadius,
        borderColor: settings.borderColor,
        borderSize: settings.borderSize,
        ...(element.name === EMPTY_COLLAGE_CELL_NAME
          ? { src: emptyCollageCellPlaceholderSrc(index, frame) }
          : {}),
      });
    });
    page?.set({ background: settings.backgroundColor });
    setStoreCollageSettings(s, settings);
    if (gapChanged) await refineCellCrops(page);
  });
}

/** Swaps one cell's photo, recomputing its cover crop for the cell's frame. */
export async function setCollageCellPhoto(
  store: PolotnoStore,
  cellId: string,
  url: string
): Promise<void> {
  const s = asCollageStore(store);
  const page = s.activePage;
  const entry = collageCellElements(page).find(({ index }) => collageCellId(index) === cellId);
  if (!entry) return;

  const size = await naturalSizeFor(url);
  const crop = size
    ? coverCropForFrame(size.width, size.height, entry.element.width, entry.element.height)
    : { cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 };

  await s.history.transaction(() => {
    entry.element.set({ src: url, name: FILLED_COLLAGE_CELL_NAME, ...crop });
  });
}

/** Fills every empty cell, in order, from `urls` (property gallery order). */
export async function fillCollageCells(store: PolotnoStore, urls: string[]): Promise<void> {
  const s = asCollageStore(store);
  const page = s.activePage;
  const emptyEntries = collageCellElements(page).filter(
    ({ element }) => element.name === EMPTY_COLLAGE_CELL_NAME
  );
  if (!emptyEntries.length || !urls.length) return;

  const assignments = emptyEntries.map((entry, i) => ({ entry, url: urls[i % urls.length]! }));
  const sizes = await Promise.all(assignments.map(({ url }) => naturalSizeFor(url)));

  await s.history.transaction(() => {
    assignments.forEach(({ entry, url }, i) => {
      const size = sizes[i];
      const crop = size
        ? coverCropForFrame(size.width, size.height, entry.element.width, entry.element.height)
        : { cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 };
      entry.element.set({ src: url, name: FILLED_COLLAGE_CELL_NAME, ...crop });
    });
  });
}

/** Clears one cell back to its empty placeholder. */
export async function clearCollageCell(store: PolotnoStore, cellId: string): Promise<void> {
  const s = asCollageStore(store);
  const page = s.activePage;
  const entry = collageCellElements(page).find(({ index }) => collageCellId(index) === cellId);
  if (!entry) return;

  await s.history.transaction(() => {
    entry.element.set({
      src: emptyCollageCellPlaceholderSrc(entry.index, entry.element),
      name: EMPTY_COLLAGE_CELL_NAME,
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
    });
  });
}

/** Drag-to-reorder: swaps photo + crop between two cells; frames stay put. */
export async function swapCollageCells(
  store: PolotnoStore,
  aCellId: string,
  bCellId: string
): Promise<void> {
  if (aCellId === bCellId) return;
  const s = asCollageStore(store);
  const page = s.activePage;
  const entries = collageCellElements(page);
  const a = entries.find(({ index }) => collageCellId(index) === aCellId);
  const b = entries.find(({ index }) => collageCellId(index) === bCellId);
  if (!a || !b) return;

  const aPatch = cellPhotoPatch(b.element, a);
  const bPatch = cellPhotoPatch(a.element, b);
  const changedIds = new Set([aCellId, bCellId]);

  await s.history.transaction(async () => {
    a.element.set(aPatch);
    b.element.set(bPatch);
    await refineCellCrops(page, changedIds);
  });
}

/** Selects a cell's element on canvas (e.g. tapping its thumbnail in the sidebar list). */
export function selectCollageCell(store: PolotnoStore, cellId: string): void {
  const s = asCollageStore(store);
  const entry = collageCellElements(s.activePage).find(
    ({ index }) => collageCellId(index) === cellId
  );
  if (entry) s.selectElements([entry.element.id]);
}

/** Opens Polotno's native drag-to-reposition crop UI for one cell. */
export function enterCellCropMode(store: PolotnoStore, cellId: string): void {
  const s = asCollageStore(store);
  const page = s.activePage;
  const entry = collageCellElements(page).find(({ index }) => collageCellId(index) === cellId);
  if (!entry) return;
  s.selectElements([entry.element.id]);
  entry.element.toggleCropMode(true);
}

function cellPhotoPatch(
  source: CollageElementLike,
  target: { index: number; element: CollageElementLike }
) {
  const isEmpty = source.name === EMPTY_COLLAGE_CELL_NAME;
  return {
    src: isEmpty ? emptyCollageCellPlaceholderSrc(target.index, target.element) : source.src,
    name: isEmpty ? EMPTY_COLLAGE_CELL_NAME : FILLED_COLLAGE_CELL_NAME,
    cropX: source.cropX ?? 0,
    cropY: source.cropY ?? 0,
    cropWidth: source.cropWidth ?? 1,
    cropHeight: source.cropHeight ?? 1,
  };
}

function emptyCollageCellPlaceholderSrc(
  index: number,
  frame: { width: number; height: number }
): string {
  return emptyCollageCellSvgDataUri(index + 1, frame.width, frame.height);
}
