import { describe, expect, it } from 'vitest';

import { auditPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterAudit';
import {
  contrastRatio,
  derivePosterPalette,
} from '@/features/dashboard/marketing/lib/poster/posterColor';
import { compilePosterDocument } from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import { buildRuleBasedPosterSpecs } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import {
  buildPosterFacts,
  formatPosterLocation,
  formatPosterMoney,
  formatPosterTime,
} from '@/features/dashboard/marketing/lib/poster/posterFacts';
import { POSTER_FONT_PAIRINGS } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  resolvePosterIcon,
  shortPosterLabel,
} from '@/features/dashboard/marketing/lib/poster/posterIcons';
import {
  cleanPosterCopy,
  normalizePosterSpec,
  POSTER_ARCHETYPE_IDS,
  type PosterFacts,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import { fitText, wrapBalanced } from '@/features/dashboard/marketing/lib/poster/posterText';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

const FORMATS: DesignTemplateFormat[] = [
  'instagram-post',
  'instagram-portrait',
  'instagram-story',
  'facebook-post',
];

const RICH_FACTS: PosterFacts = buildPosterFacts({
  propertyName: 'Kame Home',
  brandName: 'Kame Home',
  property: {
    residenceName: 'Azure North',
    city: 'San Fernando',
    state: 'Pampanga',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    amenities: [
      'WiFi',
      'Swimming Pool',
      'Heated Jacuzzi',
      'PS5 + games',
      'Netflix',
      'Coffee Maker',
      'BBQ Grill',
    ],
    pricing: { baseRate: 2799, currency: 'PHP', securityDeposit: 2000 },
  },
  photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg'],
  logoUrl: 'https://example.com/logo.png',
});

const SPARSE_FACTS: PosterFacts = buildPosterFacts({
  propertyName: 'The Upper Room at Azure North Staycation Suites',
  photos: ['https://example.com/only.jpg'],
});

const LONG_COPY = {
  eyebrow: 'Discover a slice of paradise without leaving town',
  headline: 'Without booking a flight this summer',
  accent: 'Bali vibes all day',
  subhead:
    'Escape the city and enjoy a relaxing staycation with family, friends or your special someone, with everything you need for a memorable stay.',
  chips: ['Relax', 'Unwind', 'Reconnect'],
  tagline: 'Unwind. Recharge. Just like home.',
  cta: 'Take a staycation with us',
  badge: 'PS5 + games for the ultimate staycation',
  listTitle: 'Perfect for',
};

describe('poster text fitting', () => {
  const role = POSTER_FONT_PAIRINGS['cozy-cafe'].display;

  it('balances two-line wraps instead of orphaning a word', () => {
    const lines = wrapBalanced('Game on stay in tonight', role, 100, 900);
    expect(lines).toHaveLength(2);
    const [first, second] = lines.map((line) => line.length);
    expect(Math.abs(first! - second!)).toBeLessThanOrEqual(8);
  });

  it('shrinks until the copy fits the line budget', () => {
    const fitted = fitText('A very long headline that will not fit on one line', role, {
      maxWidth: 500,
      maxFontSize: 120,
      minFontSize: 20,
      maxLines: 2,
    });
    expect(fitted.overflow).toBe(false);
    expect(fitted.lines.length).toBeLessThanOrEqual(2);
    expect(fitted.fontSize).toBeLessThan(120);
  });
});

describe('poster copy and spec normalization', () => {
  it('strips em dashes, quotes and caps words', () => {
    expect(cleanPosterCopy('"Sip slow — breathe deep"', { words: 10, chars: 60 })).toBe(
      'Sip slow, breathe deep'
    );
    // Slightly long copy is kept whole; far over budget is dropped, never cut mid-phrase.
    expect(cleanPosterCopy('Take a staycation with us', { words: 4, chars: 40 })).toBe(
      'Take a staycation with us'
    );
    expect(cleanPosterCopy('one two three four five six seven', { words: 3, chars: 60 })).toBe('');
    expect(
      cleanPosterCopy('Sip slow. Then breathe deep and stay a while longer with us', {
        words: 4,
        chars: 30,
      })
    ).toBe('Sip slow.');
  });

  it('falls back to safe enums and switches off modules without facts', () => {
    const spec = normalizePosterSpec(
      { archetype: 'made-up', fontPairing: 'comic-sans', copy: { headline: '' } },
      SPARSE_FACTS
    );
    expect(POSTER_ARCHETYPE_IDS).toContain(spec.archetype);
    expect(spec.copy.headline).not.toBe('');
    expect(spec.include).toEqual({ infoBar: false, location: false, logo: false });
    expect(spec.photoIndexes).toEqual([0]);
  });

  it('drops out-of-range photo indexes and duplicate features', () => {
    const spec = normalizePosterSpec(
      { photoIndexes: [9, 1, 1], features: [{ label: 'WiFi' }, { label: 'wifi' }, 'Pool'] },
      RICH_FACTS
    );
    expect(spec.photoIndexes).toEqual([1]);
    expect(spec.features.map((f) => f.label)).toEqual(['WiFi', 'Pool']);
  });
});

describe('poster facts', () => {
  it('formats times, money and location from stored settings', () => {
    expect(formatPosterTime('14:00')).toBe('2:00 PM');
    expect(formatPosterTime('00:30:00')).toBe('12:30 AM');
    expect(formatPosterTime('2:00 pm')).toBe('2:00 PM');
    expect(formatPosterMoney(2000, 'PHP')).toMatch(/2,000/);
    expect(formatPosterMoney(0, 'PHP')).toBeNull();
    expect(
      formatPosterLocation({
        residenceName: 'Azure North',
        city: 'San Fernando',
        state: 'Pampanga',
      })
    ).toBe('Azure North, Pampanga');
  });

  it('maps amenity labels (including custom ones) to icons', () => {
    expect(resolvePosterIcon('Heated Jacuzzi')).toBe('bath');
    expect(resolvePosterIcon('PS5 + games')).toBe('gamepad-2');
    expect(resolvePosterIcon('Swimming Pool')).toBe('waves');
    expect(resolvePosterIcon('Fantastic view')).toBe('sunset');
    expect(resolvePosterIcon('Something new')).toBe('sparkles');
  });

  it('shortens tight labels from a curated map, never by chopping words', () => {
    expect(shortPosterLabel('Coffee Maker')).toBe('Coffee');
    expect(shortPosterLabel('Air Conditioning')).toBe('Aircon');
    expect(shortPosterLabel('Swimming Pool')).toBe('Pool');
    expect(shortPosterLabel('Celebrations')).toBeNull();
    expect(shortPosterLabel('Pool')).toBeNull();
  });
});

describe('poster palette', () => {
  it('keeps text readable even from a poor accent pick', () => {
    for (const accent of ['#ffff00', '#f5f5f5', '#101010', '#b86a2c', null]) {
      const palette = derivePosterPalette({ accent });
      expect(contrastRatio(palette.fieldInk, palette.field)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(palette.accent, palette.field)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(palette.glow, palette.deep)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('poster compiler', () => {
  const cases = POSTER_ARCHETYPE_IDS.flatMap((archetype) =>
    FORMATS.flatMap((format) =>
      (
        [
          ['rich', RICH_FACTS, LONG_COPY],
          ['sparse', SPARSE_FACTS, { headline: SPARSE_FACTS.propertyName }],
        ] as const
      ).map(([profile, facts, copy]) => ({ archetype, format, profile, facts, copy }))
    )
  );

  it.each(cases)(
    '$archetype / $format / $profile passes layout QA',
    ({ archetype, format, facts, copy }) => {
      const spec = normalizePosterSpec({ archetype, copy, photoIndexes: [0, 1] }, facts);
      const document = compilePosterDocument(spec, facts, format, {
        photoSizes: { 'https://example.com/a.jpg': { width: 1600, height: 1200 } },
      });
      expect(document.pages[0]!.children.length).toBeGreaterThanOrEqual(2);
      expect(auditPosterDocument(document)).toEqual([]);
    }
  );

  it('only uses fonts from the chosen pairing (plus the brand wordmark)', () => {
    const spec = normalizePosterSpec(
      { archetype: 'magazine-cover', fontPairing: 'magazine-cover', copy: LONG_COPY },
      RICH_FACTS
    );
    const document = compilePosterDocument(spec, RICH_FACTS, 'instagram-post');
    const pairing = POSTER_FONT_PAIRINGS['magazine-cover'];
    const allowed = new Set([
      pairing.display.family,
      pairing.script.family,
      pairing.eyebrow.family,
      pairing.body.family,
      pairing.chip.family,
      'Fredoka',
    ]);
    const used = document.pages[0]!.children.filter((child) => child.type === 'text').map((child) =>
      String(child.fontFamily)
    );
    expect(used.every((family) => allowed.has(family))).toBe(true);
  });

  it('prints fact strings verbatim', () => {
    const spec = normalizePosterSpec(
      { archetype: 'sky-headline', copy: LONG_COPY, photoIndexes: [0] },
      RICH_FACTS
    );
    const texts = compilePosterDocument(spec, RICH_FACTS, 'instagram-story')
      .pages[0]!.children.filter((child) => child.type === 'text')
      .map((child) => String(child.text));
    expect(texts).toContain('2:00 PM');
    expect(texts).toContain('12:00 PM');
    expect(texts.some((text) => text.includes('2,000'))).toBe(true);
  });

  it('falls back to the type-only layout when there are no photos', () => {
    const facts = { ...SPARSE_FACTS, photos: [] };
    const spec = normalizePosterSpec({ archetype: 'sky-headline' }, facts);
    const document = compilePosterDocument(spec, facts, 'instagram-post');
    expect((document.custom?.poster as { archetype: string }).archetype).toBe('minimal-title');
  });

  it('rule-based specs give four distinct archetypes per goal', () => {
    const specs = buildRuleBasedPosterSpecs(RICH_FACTS, 'vibe');
    expect(new Set(specs.map((spec) => spec.archetype)).size).toBe(4);
    for (const spec of specs) {
      for (const format of FORMATS) {
        expect(auditPosterDocument(compilePosterDocument(spec, RICH_FACTS, format))).toEqual([]);
      }
    }
  });
});
