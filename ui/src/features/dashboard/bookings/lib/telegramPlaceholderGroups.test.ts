import { describe, expect, it } from 'vitest';

import {
  buildValidPlaceholderKeySet,
  placeholderLinesFromKeys,
  enrichPlaceholderLines,
  groupPlaceholders,
  filterPlaceholders,
} from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';

describe('buildValidPlaceholderKeySet', () => {
  it('buildValidPlaceholderKeySet is exported', () => {
    expect(typeof buildValidPlaceholderKeySet).toBe('function');
  });
});

describe('placeholderLinesFromKeys', () => {
  it('placeholderLinesFromKeys is exported', () => {
    expect(typeof placeholderLinesFromKeys).toBe('function');
  });
});

describe('enrichPlaceholderLines', () => {
  it('enrichPlaceholderLines is exported', () => {
    expect(typeof enrichPlaceholderLines).toBe('function');
  });

  it('reads colon catalog lines back into token, label, and example', () => {
    const lines = placeholderLinesFromKeys(['primary_guest_name', 'stay_guide_cta_section']);
    expect(lines[0]).toBe('{{primary_guest_name}}: Guest full name');

    const items = enrichPlaceholderLines(lines);
    expect(items[0]).toMatchObject({
      token: '{{primary_guest_name}}',
      description: 'Guest full name',
      example: 'Juan Dela Cruz',
      group: 'Guest',
    });
    expect(items[1]).toMatchObject({
      token: '{{stay_guide_cta_section}}',
      description: 'Guest stay guide button',
      example: 'Stay guide button',
    });

    expect(buildValidPlaceholderKeySet(lines)).toEqual(
      new Set(['primary_guest_name', 'stay_guide_cta_section'])
    );
  });
});

describe('groupPlaceholders', () => {
  it('groupPlaceholders is exported', () => {
    expect(typeof groupPlaceholders).toBe('function');
  });
});

describe('filterPlaceholders', () => {
  it('filterPlaceholders is exported', () => {
    expect(typeof filterPlaceholders).toBe('function');
  });
});
