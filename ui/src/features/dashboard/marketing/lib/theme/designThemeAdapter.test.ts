import { beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MARKETING_THUMB_BINDING } from '@/features/dashboard/marketing/lib/marketingDefaultBinding';
import {
  buildPolotnoCampaignDocument,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_LABEL,
  FONT_NUMERAL,
} from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import {
  polotnoHandEditedIds,
  polotnoThemeBaseline,
  rethemePolotnoDocument,
  themeToCampaignPalette,
} from '@/features/dashboard/marketing/lib/theme/designThemeAdapter';
import {
  DEFAULT_MARKETING_THEME_TOKENS,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { contrastRatio } from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';

const ocean: MarketingThemeTokens = {
  version: 1,
  palette: {
    primary: '#2a9d8f',
    secondary: '#dff3ef',
    accent: '#e76f51',
    surface: '#f7fbfa',
    ink: '#16324a',
  },
  fonts: { display: 'Playfair Display', body: 'Lora', label: 'Montserrat' },
  background: 'solid',
  corners: 'soft',
};

type Node = { id: string; fontFamily?: string; fill?: string; children?: Node[] };

function allNodes(doc: unknown): Node[] {
  const out: Node[] = [];
  const walk = (nodes: Node[] = []) =>
    nodes.forEach((node) => {
      out.push(node);
      walk(node.children);
    });
  for (const page of (doc as { pages: Array<{ children: Node[] }> }).pages) walk(page.children);
  return out;
}

describe('themeToCampaignPalette', () => {
  it('maps theme roles onto the campaign palette with readable text on the accent', () => {
    const palette = themeToCampaignPalette(ocean);
    expect(palette.accent).toBe(ocean.palette.primary);
    expect(palette.cream).toBe(ocean.palette.surface);
    expect(contrastRatio(palette.accentForeground, palette.accent)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(palette.ink, palette.cream)).toBeGreaterThanOrEqual(7);
  });
});

describe('buildPolotnoCampaignDocument with a theme', () => {
  // OpenPolotno's svgToURL reads window.btoa; unit tests run in Node.
  beforeAll(() => {
    if (typeof window === 'undefined') vi.stubGlobal('window', { btoa: globalThis.btoa });
  });

  it('uses only the theme fonts (numerals in the display face)', () => {
    const doc = buildPolotnoCampaignDocument(
      'promo-500-off-instagram-post',
      DEFAULT_MARKETING_THUMB_BINDING,
      {
        theme: ocean,
      }
    )!;
    const families = new Set(
      allNodes(doc)
        .map((n) => n.fontFamily)
        .filter(Boolean)
    );
    for (const old of [FONT_DISPLAY, FONT_LABEL, FONT_BODY, FONT_NUMERAL]) {
      expect(families.has(old), old).toBe(false);
    }
    expect(
      [...families].every((f) => ['Playfair Display', 'Lora', 'Montserrat'].includes(f!))
    ).toBe(true);
  });

  it('is unchanged without a theme (brand path still works)', () => {
    const doc = buildPolotnoCampaignDocument(
      'promo-500-off-instagram-post',
      DEFAULT_MARKETING_THUMB_BINDING
    )!;
    expect(allNodes(doc).some((n) => n.fontFamily === FONT_DISPLAY)).toBe(true);
  });
});

describe('rethemePolotnoDocument', () => {
  const doc = {
    pages: [
      {
        id: 'p1',
        background: DEFAULT_MARKETING_THEME_TOKENS.palette.surface,
        children: [
          { id: 'a', fill: DEFAULT_MARKETING_THEME_TOKENS.palette.primary, fontFamily: 'Fraunces' },
          { id: 'b', fill: '#123456', fontFamily: 'Jost' },
          { id: 'g', children: [{ id: 'c', fill: DEFAULT_MARKETING_THEME_TOKENS.palette.ink }] },
          { id: 'img', src: 'https://x.test/a.jpg' },
        ],
      },
    ],
  };

  it('moves colors, fonts and the page color; skips locked elements; never mutates', () => {
    const before = structuredClone(doc);
    const out = rethemePolotnoDocument(doc, DEFAULT_MARKETING_THEME_TOKENS, ocean, ['b']);
    expect(doc).toEqual(before);
    const nodes = allNodes(out);
    expect(out.pages[0]!.background).toBe(ocean.palette.surface);
    expect(nodes.find((n) => n.id === 'a')).toMatchObject({
      fill: ocean.palette.primary,
      fontFamily: 'Playfair Display',
    });
    expect(nodes.find((n) => n.id === 'b')).toMatchObject({ fill: '#123456', fontFamily: 'Jost' });
    expect(nodes.find((n) => n.id === 'c')).toMatchObject({ fill: ocean.palette.ink });
    expect(nodes.find((n) => n.id === 'img')).toEqual({ id: 'img', src: 'https://x.test/a.jpg' });
  });

  it('returns the same document for the same theme', () => {
    expect(rethemePolotnoDocument(doc, ocean, { ...ocean })).toBe(doc);
  });
});

describe('hand-edit detection', () => {
  it('flags changed and newly added elements only', () => {
    const base = {
      pages: [
        {
          children: [
            { id: 'a', fill: '#111111' },
            { id: 'b', fill: '#222222', x: 1 },
          ],
        },
      ],
    };
    const baseline = polotnoThemeBaseline(base);
    const edited = {
      pages: [
        {
          children: [
            { id: 'a', fill: '#999999' },
            { id: 'b', fill: '#222222', x: 50 },
            { id: 'new', fill: '#000000' },
          ],
        },
      ],
    };
    expect(polotnoHandEditedIds(edited, baseline).sort()).toEqual(['a', 'new']);
  });
});
