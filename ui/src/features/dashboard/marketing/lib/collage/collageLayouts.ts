import type { CollageBestForHint } from '@/features/dashboard/marketing/lib/collage/collageTypes';

/** Normalized (0–1) cell rect — the same shape works at any canvas size/format. */
export type CollageCellRect = { xr: number; yr: number; wr: number; hr: number };

export type CollageLayout = {
  id: string;
  name: string;
  cellCount: number;
  /** Sort hint only — every layout renders in every format. */
  bestFor?: CollageBestForHint[];
  cells: CollageCellRect[];
};

/** Enforced by the registry, not a runtime check: there is simply no 10+ layout. */
export const MAX_COLLAGE_CELLS = 9;

const third = 1 / 3;
const twoThirds = 2 / 3;

export const COLLAGE_LAYOUTS: CollageLayout[] = [
  {
    id: 'duo-v',
    name: 'Stacked duo',
    cellCount: 2,
    bestFor: ['instagram-story', 'instagram-post'],
    cells: [
      { xr: 0, yr: 0, wr: 1, hr: 0.5 },
      { xr: 0, yr: 0.5, wr: 1, hr: 0.5 },
    ],
  },
  {
    id: 'duo-h',
    name: 'Side by side',
    cellCount: 2,
    bestFor: ['instagram-post', 'facebook-post'],
    cells: [
      { xr: 0, yr: 0, wr: 0.5, hr: 1 },
      { xr: 0.5, yr: 0, wr: 0.5, hr: 1 },
    ],
  },
  {
    id: 'before-after',
    name: 'Before / after',
    cellCount: 2,
    bestFor: ['instagram-post', 'facebook-post'],
    cells: [
      { xr: 0, yr: 0, wr: 0.5, hr: 1 },
      { xr: 0.5, yr: 0, wr: 0.5, hr: 1 },
    ],
  },
  {
    id: 'story-hero-2',
    name: 'Hero + detail',
    cellCount: 2,
    bestFor: ['instagram-story'],
    cells: [
      { xr: 0, yr: 0, wr: 1, hr: 0.68 },
      { xr: 0, yr: 0.68, wr: 1, hr: 0.32 },
    ],
  },
  {
    id: 'trio-left-hero',
    name: 'Left hero trio',
    cellCount: 3,
    bestFor: ['instagram-post', 'facebook-post'],
    cells: [
      { xr: 0, yr: 0, wr: 0.62, hr: 1 },
      { xr: 0.62, yr: 0, wr: 0.38, hr: 0.5 },
      { xr: 0.62, yr: 0.5, wr: 0.38, hr: 0.5 },
    ],
  },
  {
    id: 'trio-strip',
    name: 'Strip of three',
    cellCount: 3,
    bestFor: ['facebook-post'],
    cells: [
      { xr: 0, yr: 0, wr: third, hr: 1 },
      { xr: third, yr: 0, wr: third, hr: 1 },
      { xr: twoThirds, yr: 0, wr: third, hr: 1 },
    ],
  },
  {
    id: 'story-stack-3',
    name: 'Story stack',
    cellCount: 3,
    bestFor: ['instagram-story'],
    cells: [
      { xr: 0, yr: 0, wr: 1, hr: 0.4 },
      { xr: 0, yr: 0.4, wr: 1, hr: 0.3 },
      { xr: 0, yr: 0.7, wr: 1, hr: 0.3 },
    ],
  },
  {
    id: 'quad-grid',
    name: '2x2 grid',
    cellCount: 4,
    bestFor: ['instagram-post'],
    cells: [
      { xr: 0, yr: 0, wr: 0.5, hr: 0.5 },
      { xr: 0.5, yr: 0, wr: 0.5, hr: 0.5 },
      { xr: 0, yr: 0.5, wr: 0.5, hr: 0.5 },
      { xr: 0.5, yr: 0.5, wr: 0.5, hr: 0.5 },
    ],
  },
  {
    id: 'quad-left-hero',
    name: 'Left hero quad',
    cellCount: 4,
    bestFor: ['facebook-post', 'instagram-post'],
    cells: [
      { xr: 0, yr: 0, wr: 0.6, hr: 1 },
      { xr: 0.6, yr: 0, wr: 0.4, hr: third },
      { xr: 0.6, yr: third, wr: 0.4, hr: third },
      { xr: 0.6, yr: twoThirds, wr: 0.4, hr: third },
    ],
  },
  {
    id: 'film-strip-4',
    name: 'Film strip',
    cellCount: 4,
    bestFor: ['facebook-post'],
    cells: [
      { xr: 0, yr: 0, wr: 0.25, hr: 1 },
      { xr: 0.25, yr: 0, wr: 0.25, hr: 1 },
      { xr: 0.5, yr: 0, wr: 0.25, hr: 1 },
      { xr: 0.75, yr: 0, wr: 0.25, hr: 1 },
    ],
  },
  {
    id: 'quint-mosaic',
    name: 'Mosaic five',
    cellCount: 5,
    bestFor: ['instagram-post'],
    cells: [
      { xr: 0, yr: 0, wr: 0.6, hr: 0.55 },
      { xr: 0.6, yr: 0, wr: 0.4, hr: 0.55 },
      { xr: 0, yr: 0.55, wr: third, hr: 0.45 },
      { xr: third, yr: 0.55, wr: third, hr: 0.45 },
      { xr: twoThirds, yr: 0.55, wr: third, hr: 0.45 },
    ],
  },
  {
    id: 'polaroid-scatter',
    name: 'Scattered five',
    cellCount: 5,
    bestFor: ['instagram-post', 'instagram-story'],
    cells: [
      { xr: 0, yr: 0, wr: 0.4, hr: 0.35 },
      { xr: 0.4, yr: 0, wr: 0.6, hr: 0.35 },
      { xr: 0, yr: 0.35, wr: 0.6, hr: 0.35 },
      { xr: 0.6, yr: 0.35, wr: 0.4, hr: 0.35 },
      { xr: 0, yr: 0.7, wr: 1, hr: 0.3 },
    ],
  },
  {
    id: 'hex-grid',
    name: '3x2 grid',
    cellCount: 6,
    bestFor: ['facebook-post', 'instagram-post'],
    cells: [
      { xr: 0, yr: 0, wr: third, hr: 0.5 },
      { xr: third, yr: 0, wr: third, hr: 0.5 },
      { xr: twoThirds, yr: 0, wr: third, hr: 0.5 },
      { xr: 0, yr: 0.5, wr: third, hr: 0.5 },
      { xr: third, yr: 0.5, wr: third, hr: 0.5 },
      { xr: twoThirds, yr: 0.5, wr: third, hr: 0.5 },
    ],
  },
  {
    id: 'nine-grid',
    name: '3x3 grid',
    cellCount: 9,
    bestFor: ['instagram-post'],
    cells: Array.from({ length: 9 }, (_, i) => ({
      xr: (i % 3) * third,
      yr: Math.floor(i / 3) * third,
      wr: third,
      hr: third,
    })),
  },
];

const LAYOUTS_BY_ID = new Map(COLLAGE_LAYOUTS.map((layout) => [layout.id, layout]));

export function getCollageLayout(layoutId: string): CollageLayout | null {
  return LAYOUTS_BY_ID.get(layoutId) ?? null;
}

export const DEFAULT_COLLAGE_LAYOUT_ID = 'quad-grid';

export function collageLayoutsForCellCount(cellCount: number | null): CollageLayout[] {
  if (cellCount == null) return COLLAGE_LAYOUTS;
  if (cellCount >= 5) return COLLAGE_LAYOUTS.filter((layout) => layout.cellCount >= 5);
  return COLLAGE_LAYOUTS.filter((layout) => layout.cellCount === cellCount);
}
