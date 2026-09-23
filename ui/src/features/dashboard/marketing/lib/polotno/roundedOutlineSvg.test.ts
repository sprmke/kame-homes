import { describe, expect, it } from 'vitest';

import { roundedOutlineSvgMarkup, roundedOutlineSvgUrl } from '@/features/dashboard/marketing/lib/polotno/roundedOutlineSvg';

describe('roundedOutlineSvgMarkup', () => {

  it('roundedOutlineSvgMarkup is exported', () => {
    expect(typeof roundedOutlineSvgMarkup).toBe('function');
  });

});

describe('roundedOutlineSvgUrl', () => {

  it('roundedOutlineSvgUrl is exported', () => {
    expect(typeof roundedOutlineSvgUrl).toBe('function');
  });

});
