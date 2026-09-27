import { describe, expect, it } from 'vitest';

import { resolveContactPhone, resolveSocialLinks } from './marketingSiteLinks';

describe('resolveSocialLinks', () => {
  it('returns nothing when unset', () => {
    expect(resolveSocialLinks({})).toEqual([]);
  });

  it('keeps https URLs in a stable order and drops the rest', () => {
    expect(
      resolveSocialLinks({
        twitter: 'https://x.com/kamehomes',
        facebook: ' https://facebook.com/kamehomes ',
        instagram: 'javascript:alert(1)',
      }).map((l) => [l.label, l.href])
    ).toEqual([
      ['Facebook', 'https://facebook.com/kamehomes'],
      ['Twitter', 'https://x.com/kamehomes'],
    ]);
  });

  it('rejects http and malformed values', () => {
    expect(resolveSocialLinks({ facebook: 'http://facebook.com/a', instagram: 'nope' })).toEqual(
      []
    );
  });
});

describe('resolveContactPhone', () => {
  it('returns null when unset or implausible', () => {
    expect(resolveContactPhone(undefined)).toBeNull();
    expect(resolveContactPhone('  ')).toBeNull();
    expect(resolveContactPhone('123')).toBeNull();
  });

  it('builds a tel link without spaces', () => {
    expect(resolveContactPhone('+63 917 123 4567')).toEqual({
      href: 'tel:+639171234567',
      label: '+63 917 123 4567',
    });
  });
});
