import { describe, expect, it } from 'vitest';

import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import { auditPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterAudit';
import { derivePosterPalette } from '@/features/dashboard/marketing/lib/poster/posterColor';
import { compilePosterDocument } from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import { buildRuleBasedPosterSpecs } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import {
  buildPosterFacts,
  formatPosterLocation,
  formatPosterTime,
} from '@/features/dashboard/marketing/lib/poster/posterFacts';
import { POSTER_FONT_PAIRINGS } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  normalizePosterSpec,
  POSTER_GOALS,
  posterShortName,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import { fitText } from '@/features/dashboard/marketing/lib/poster/posterText';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

const FORMATS: DesignTemplateFormat[] = [
  'instagram-post',
  'instagram-portrait',
  'instagram-story',
  'facebook-post',
];

function doc(children: Record<string, unknown>[]): PolotnoDesignDocument {
  return {
    width: 1080,
    height: 1080,
    schemaVersion: 2,
    fonts: [],
    pages: [{ id: 'p', background: '#fff', children }],
  };
}

const text = (name: string, extra: Record<string, unknown>) => ({
  id: name,
  type: 'text',
  name,
  text: 'Hello there',
  x: 100,
  y: 100,
  width: 400,
  height: 60,
  fontSize: 40,
  align: 'left',
  ...extra,
});

describe('auditPosterDocument', () => {
  it('flags text off canvas, tiny text, empty text and overflow', () => {
    const kinds = auditPosterDocument(
      doc([
        text('Off', { x: 900, width: 400 }),
        text('Tiny', { y: 400, fontSize: 12 }),
        text('Empty', { y: 600, text: '  ' }),
        text('Overflow', { y: 800, custom: { posterSlot: { overflow: true } } }),
      ])
    ).map((issue) => `${issue.kind}:${issue.element}`);
    expect(kinds).toEqual([
      'out-of-bounds:Off',
      'text-too-small:Tiny',
      'empty-text:Empty',
      'text-overflow:Overflow',
    ]);
  });

  it('flags overlapping text unless a slot allows it', () => {
    expect(
      auditPosterDocument(doc([text('A', {}), text('B', { y: 110 })])).map((i) => i.kind)
    ).toEqual(['text-overlap']);
    expect(
      auditPosterDocument(
        doc([text('A', {}), text('B', { y: 110, custom: { posterSlot: { allowOverlap: true } } })])
      )
    ).toEqual([]);
  });

  it('lets full-bleed photos and scrims touch the edges', () => {
    expect(
      auditPosterDocument(
        doc([
          { id: 'p', type: 'image', name: 'Hero photo', x: -5, y: -5, width: 1100, height: 1100 },
          { id: 's', type: 'figure', name: 'Scrim top', x: 0, y: 0, width: 1080, height: 1200 },
        ])
      )
    ).toEqual([]);
  });

  it('reports NaN geometry instead of crashing', () => {
    expect(auditPosterDocument(doc([text('Broken', { x: Number.NaN })]))[0]?.kind).toBe(
      'invalid-geometry'
    );
  });
});

describe('poster edge cases', () => {
  const bare = buildPosterFacts({ propertyName: 'Studio 12', photos: [] });

  it.each(POSTER_GOALS)('goal %s works with no photos, amenities or times', (goal) => {
    for (const spec of buildRuleBasedPosterSpecs(bare, goal)) {
      for (const format of FORMATS) {
        const compiled = compilePosterDocument(spec, bare, format);
        expect(auditPosterDocument(compiled)).toEqual([]);
        expect(JSON.stringify(compiled)).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('never prints an info bar or location pill without the facts behind them', () => {
    const spec = normalizePosterSpec(
      { archetype: 'sky-headline', include: { infoBar: true, location: true } },
      buildPosterFacts({ propertyName: 'Studio 12', photos: ['https://cdn.test/a.jpg'] })
    );
    expect(spec.include.infoBar).toBe(false);
    expect(spec.include.location).toBe(false);
  });

  it('survives hostile model output', () => {
    const facts = buildPosterFacts({
      propertyName: 'Kame Home',
      photos: ['https://cdn.test/a.jpg'],
    });
    for (const raw of [null, 42, 'poster', [], { copy: 'x', features: 'y', palette: 7 }]) {
      const spec = normalizePosterSpec(raw, facts);
      expect(spec.copy.headline).toBe('Kame Home');
      for (const format of FORMATS) {
        expect(auditPosterDocument(compilePosterDocument(spec, facts, format))).toEqual([]);
      }
    }
  });

  it('ignores invalid palette input and still guarantees contrast', () => {
    const palette = derivePosterPalette({ accent: 'red', secondary: '#12', field: '#000000' });
    expect(palette.accent).toMatch(/^#[0-9a-f]{6}$/);
    // A black "field" is lifted back to paper so body text stays readable.
    expect(palette.field).not.toBe('#000000');
  });

  it('formats odd time and location input safely', () => {
    expect(formatPosterTime('')).toBeNull();
    expect(formatPosterTime('25:00')).toBe('25:00');
    expect(formatPosterTime('noon')).toBe('noon');
    expect(formatPosterTime('12:00 nn')).toBe('12:00 NN');
    expect(formatPosterLocation({ residenceName: 'Makati', city: 'Makati', state: null })).toBe(
      'Makati'
    );
    expect(formatPosterLocation({})).toBeNull();
  });

  it('shortens listing names at natural breaks only', () => {
    expect(posterShortName('The Upper Room at Azure North Suites')).toBe('The Upper Room');
    expect(posterShortName('Charming 3BR Home in Makati')).toBe('Charming 3BR Home');
    expect(posterShortName('Kame Home | Azure North')).toBe('Kame Home');
    expect(posterShortName('At Home')).toBe('At Home');
  });

  it('reports overflow for a single word wider than its box instead of breaking it', () => {
    const fitted = fitText('Supercalifragilistic', POSTER_FONT_PAIRINGS['cozy-cafe'].display, {
      maxWidth: 120,
      maxFontSize: 60,
      minFontSize: 30,
      maxLines: 2,
    });
    expect(fitted.overflow).toBe(true);
    expect(fitted.lines).toEqual(['Supercalifragilistic']);
  });
});
