import { describe, expect, it } from 'vitest';

import {
  buildCollageDocument,
  collageCellId,
  collageCellIndex,
  collageFrames,
  EMPTY_COLLAGE_CELL_NAME,
  FILLED_COLLAGE_CELL_NAME,
  planRelayout,
  readCollageSettings,
  resolveCollageSettings,
  withCollageSettings,
} from '@/features/dashboard/marketing/lib/collage/collageDocument';
import {
  COLLAGE_LAYOUTS,
  getCollageLayout,
  MAX_COLLAGE_CELLS,
} from '@/features/dashboard/marketing/lib/collage/collageLayouts';
import type { CollageCellState } from '@/features/dashboard/marketing/lib/collage/collageTypes';

const QUAD = getCollageLayout('quad-grid')!;
const DUO = getCollageLayout('duo-h')!;
const NINE = getCollageLayout('nine-grid')!;

describe('collage layout registry', () => {
  it('caps every layout at 9 cells', () => {
    for (const layout of COLLAGE_LAYOUTS) {
      expect(layout.cellCount).toBeLessThanOrEqual(MAX_COLLAGE_CELLS);
      expect(layout.cells).toHaveLength(layout.cellCount);
    }
  });

  it('tiles every layout’s normalized cells edge-to-edge with no gaps or overlap', () => {
    for (const layout of COLLAGE_LAYOUTS) {
      const totalArea = layout.cells.reduce((sum, cell) => sum + cell.wr * cell.hr, 0);
      expect(totalArea).toBeCloseTo(1, 5);
      for (const cell of layout.cells) {
        expect(cell.xr).toBeGreaterThanOrEqual(0);
        expect(cell.yr).toBeGreaterThanOrEqual(0);
        expect(cell.xr + cell.wr).toBeLessThanOrEqual(1 + 1e-9);
        expect(cell.yr + cell.hr).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe('collageCellId / collageCellIndex', () => {
  it('round-trips', () => {
    for (let i = 0; i < 9; i++) {
      expect(collageCellIndex(collageCellId(i))).toBe(i);
    }
  });

  it('returns -1 for an unrecognized id', () => {
    expect(collageCellIndex('not-a-cell')).toBe(-1);
  });
});

describe('collageFrames', () => {
  it('sums cell area to the canvas minus outer padding and gap insets', () => {
    const settings = resolveCollageSettings({ layoutId: QUAD.id, gap: 10, outerPadding: 20 });
    const frames = collageFrames(QUAD, settings, 1000, 1000);
    expect(frames).toHaveLength(4);

    // 2x2 grid: each cell should be exactly half the inner width/height minus one full gap.
    const innerSize = 1000 - 20 * 2;
    const expectedCellSize = innerSize / 2 - 10;
    for (const frame of frames) {
      expect(frame.width).toBeCloseTo(expectedCellSize, 0);
      expect(frame.height).toBeCloseTo(expectedCellSize, 0);
    }

    // No frame escapes the outer padding.
    for (const frame of frames) {
      expect(frame.x).toBeGreaterThanOrEqual(20);
      expect(frame.y).toBeGreaterThanOrEqual(20);
      expect(frame.x + frame.width).toBeLessThanOrEqual(1000 - 20 + 1);
      expect(frame.y + frame.height).toBeLessThanOrEqual(1000 - 20 + 1);
    }
  });

  it('produces adjacent (gapless) frames when gap is zero', () => {
    const settings = resolveCollageSettings({ layoutId: DUO.id, gap: 0, outerPadding: 0 });
    const [left, right] = collageFrames(DUO, settings, 1000, 800);
    expect(left!.x + left!.width).toBe(right!.x);
  });
});

describe('buildCollageDocument', () => {
  it('builds one image child per layout cell, tagged with a stable collageCellId', () => {
    const settings = resolveCollageSettings({ layoutId: QUAD.id });
    const doc = buildCollageDocument(QUAD, [], settings, 'instagram-post');

    expect(doc.width).toBe(1080);
    expect(doc.height).toBe(1080);
    expect(doc.custom.collage.layoutId).toBe(QUAD.id);
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0]!.children).toHaveLength(4);

    doc.pages[0]!.children.forEach((child, index) => {
      expect(child.type).toBe('image');
      expect(child.name).toBe(EMPTY_COLLAGE_CELL_NAME);
      expect((child.custom as { collageCellId: string }).collageCellId).toBe(collageCellId(index));
      expect(String(child.src)).toMatch(/^data:image\/svg\+xml/);
    });
  });

  it('fills provided photos in cell order and marks the rest empty', () => {
    const settings = resolveCollageSettings({ layoutId: DUO.id });
    const doc = buildCollageDocument(
      DUO,
      [{ url: 'https://cdn.example/a.jpg' }, null],
      settings,
      'instagram-post'
    );
    const [first, second] = doc.pages[0]!.children;
    expect(first!.name).toBe(FILLED_COLLAGE_CELL_NAME);
    expect(first!.src).toBe('https://cdn.example/a.jpg');
    expect(second!.name).toBe(EMPTY_COLLAGE_CELL_NAME);
  });

  it('applies style settings (radius/border/background) to every cell', () => {
    const settings = resolveCollageSettings({
      layoutId: DUO.id,
      cornerRadius: 12,
      borderSize: 3,
      borderColor: '#111111',
      backgroundColor: '#fafafa',
    });
    const doc = buildCollageDocument(DUO, [], settings, 'instagram-post');
    expect(doc.pages[0]!.background).toBe('#fafafa');
    for (const child of doc.pages[0]!.children) {
      expect(child.cornerRadius).toBe(12);
      expect(child.borderSize).toBe(3);
      expect(child.borderColor).toBe('#111111');
    }
  });
});

describe('readCollageSettings / withCollageSettings', () => {
  it('returns null when there is no collage block', () => {
    expect(readCollageSettings({ custom: {} })).toBeNull();
    expect(readCollageSettings(null)).toBeNull();
    expect(readCollageSettings({})).toBeNull();
  });

  it('round-trips through a store-shaped JSON object', () => {
    const settings = resolveCollageSettings({ layoutId: NINE.id, gap: 8 });
    const storeJson = { custom: { collage: settings }, pages: [] };
    expect(readCollageSettings(storeJson)).toEqual(settings);
  });

  it('merges a patch onto the existing custom block without losing other keys', () => {
    const before = { templateId: 'promo-1', collage: resolveCollageSettings({ layoutId: DUO.id }) };
    const after = withCollageSettings(before, { gap: 24 });
    expect(after.templateId).toBe('promo-1');
    expect((after.collage as { gap: number }).gap).toBe(24);
    expect((after.collage as { layoutId: string }).layoutId).toBe(DUO.id);
  });
});

describe('planRelayout', () => {
  it('preserves photo order 4→2: extra cells are dropped, not reshuffled', () => {
    const settings = resolveCollageSettings({ layoutId: QUAD.id });
    const frames4 = collageFrames(QUAD, settings, 1080, 1080);
    const current: CollageCellState[] = frames4.map((frame, i) => ({
      cellId: collageCellId(i),
      frame,
      src: `https://cdn.example/${i}.jpg`,
      elementId: `el-${i}`,
    }));

    const next = planRelayout(current, DUO, settings, 1080, 1080);
    expect(next).toHaveLength(2);
    expect(next[0]!.src).toBe('https://cdn.example/0.jpg');
    expect(next[1]!.src).toBe('https://cdn.example/1.jpg');
  });

  it('preserves photo order 2→4: new cells start empty', () => {
    const settings = resolveCollageSettings({ layoutId: DUO.id });
    const frames2 = collageFrames(DUO, settings, 1080, 1080);
    const current: CollageCellState[] = frames2.map((frame, i) => ({
      cellId: collageCellId(i),
      frame,
      src: `https://cdn.example/${i}.jpg`,
      elementId: `el-${i}`,
    }));

    const next = planRelayout(current, QUAD, settings, 1080, 1080);
    expect(next).toHaveLength(4);
    expect(next[0]!.src).toBe('https://cdn.example/0.jpg');
    expect(next[1]!.src).toBe('https://cdn.example/1.jpg');
    expect(next[2]!.src).toBeNull();
    expect(next[3]!.src).toBeNull();
  });

  it('updates the layoutId carried in the resolved settings used for frame geometry', () => {
    const settings = resolveCollageSettings({ layoutId: DUO.id });
    const next = planRelayout([], NINE, settings, 1080, 1080);
    expect(next).toHaveLength(9);
  });
});
