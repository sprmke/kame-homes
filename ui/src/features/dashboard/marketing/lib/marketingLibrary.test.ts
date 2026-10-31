import { describe, expect, it } from 'vitest';

import {
  builtinTemplateCatalog,
  calendarNameFromTheme,
  daysUntilPurge,
  designPresetIdForSize,
  filterTemplates,
  flatTemplates,
  formatEditedAt,
  nextSequencedName,
  normalizeDesignName,
  normalizeStartSize,
  sizeLabel,
  startSizesFor,
} from '@/features/dashboard/marketing/lib/marketingLibrary';

describe('sizes', () => {
  it('labels known sizes and falls back for unknown ones', () => {
    expect(sizeLabel('design', 'instagram-story')).toBe('Story');
    expect(sizeLabel('calendar', 'instagram-story')).toBe('Portrait');
    expect(sizeLabel('video', 'landscape')).toBe('Landscape');
    expect(sizeLabel('video', 'facebook-post')).toBe('Custom size');
  });

  it('never starts a post in 4:5 (no preset layouts)', () => {
    expect(startSizesFor('design').map((size) => size.value)).not.toContain('instagram-portrait');
    expect(startSizesFor('video')).toHaveLength(3);
  });

  it('normalizes start sizes', () => {
    expect(normalizeStartSize('video', 'landscape')).toBe('landscape');
    expect(normalizeStartSize('video', 'nope')).toBe('instagram-story');
    expect(normalizeStartSize('design', null)).toBe('instagram-post');
  });
});

describe('calendar draft names', () => {
  it('names a new calendar after its theme', () => {
    expect(calendarNameFromTheme('Desk Buddy')).toBe('Desk Buddy calendar');
    expect(calendarNameFromTheme('  Property   colors ')).toBe('Property colors calendar');
    expect(calendarNameFromTheme('Coast calendar')).toBe('Coast calendar');
    expect(calendarNameFromTheme('')).toBe('Calendar');
  });

  it('appends the next free number when that name is taken', () => {
    const taken = ['Desk Buddy calendar', 'desk buddy calendar 2', 'Desk Buddy calendar notes'];
    expect(nextSequencedName('Desk Buddy calendar', taken)).toBe('Desk Buddy calendar 3');
    expect(nextSequencedName('Desk Buddy calendar', [])).toBe('Desk Buddy calendar');
    expect(nextSequencedName('Desk Buddy calendar', ['Desk Buddy calendar 4'])).toBe(
      'Desk Buddy calendar'
    );
  });
});

describe('normalizeDesignName', () => {
  it('trims, collapses and caps', () => {
    expect(normalizeDesignName('  Weekday   deal ')).toBe('Weekday deal');
    expect(normalizeDesignName('   ')).toBeNull();
    expect(normalizeDesignName('x'.repeat(200))).toHaveLength(120);
  });
});

describe('formatEditedAt', () => {
  const now = new Date('2026-10-19T08:00:00Z'); // 16:00 in Manila

  it('uses short relative labels', () => {
    expect(formatEditedAt('2026-10-19T07:59:40Z', now)).toBe('Just now');
    expect(formatEditedAt('2026-10-19T07:55:00Z', now)).toBe('5m ago');
    expect(formatEditedAt('2026-10-19T05:00:00Z', now)).toBe('3h ago');
    expect(formatEditedAt('2026-10-18T08:00:00Z', now)).toBe('Yesterday');
    expect(formatEditedAt('2026-10-15T08:00:00Z', now)).toBe('Thu');
    expect(formatEditedAt('2026-09-02T08:00:00Z', now)).toBe('Sep 2');
    expect(formatEditedAt('2025-09-02T08:00:00Z', now)).toBe('Sep 2, 2025');
    expect(formatEditedAt('nope', now)).toBe('');
  });

  it('counts days in Manila time', () => {
    // 23:30 Manila on Oct 18 is "Yesterday" even though it is Oct 18 15:30 UTC.
    expect(formatEditedAt('2026-10-18T15:30:00Z', now)).toBe('Yesterday');
  });
});

describe('daysUntilPurge', () => {
  it('counts down from 30 days and never goes negative', () => {
    const now = new Date('2026-10-31T00:00:00Z');
    expect(daysUntilPurge('2026-10-31T00:00:00Z', now)).toBe(30);
    expect(daysUntilPurge('2026-10-21T00:00:00Z', now)).toBe(20);
    expect(daysUntilPurge('2026-08-01T00:00:00Z', now)).toBe(0);
  });
});

describe('template catalogs', () => {
  it('lists post presets for the size with base ids as refs', () => {
    const categories = builtinTemplateCatalog('design', 'instagram-story');
    expect(categories.map((category) => category.id)).toEqual([
      'promo',
      'slots',
      'giveaway',
      'fully-booked',
      'reviews',
    ]);
    const first = categories[0]!.templates[0]!;
    expect(first.ref).toEqual({ kind: 'preset', id: 'promo-500-off' });
    expect(first.presetId).toBe('promo-500-off-instagram-story');
    expect(first.sourceId).toBe('preset:promo-500-off');
  });

  it('lists every calendar layout and video recipe once', () => {
    const calendar = flatTemplates(builtinTemplateCatalog('calendar', 'instagram-post'));
    expect(calendar).toHaveLength(14);
    const video = flatTemplates(builtinTemplateCatalog('video', 'instagram-story'));
    expect(new Set(video.map((template) => template.presetId)).size).toBe(video.length);
  });

  it('filters by name, description and category label', () => {
    const calendar = flatTemplates(builtinTemplateCatalog('calendar', 'instagram-post'));
    expect(filterTemplates(calendar, 'bubble pop').map((t) => t.presetId)).toEqual([
      'social-availability',
    ]);
    expect(filterTemplates(calendar, '  ')).toHaveLength(calendar.length);
    const posts = flatTemplates(builtinTemplateCatalog('design', 'instagram-post'));
    expect(filterTemplates(posts, 'giveaway', { giveaway: 'Giveaway' }).length).toBeGreaterThan(0);
  });

  it('builds the per-size post preset id', () => {
    expect(designPresetIdForSize('slots-3', 'facebook-post')).toBe('slots-3-facebook-post');
  });
});
