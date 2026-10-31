import { describe, expect, it } from 'vitest';

import { entityInitials, isUsableLogoNaturalSize, MIN_ENTITY_LOGO_PX } from '@/lib/entityInitials';

describe('entityInitials', () => {
  it('returns fallback for empty input', () => {
    expect(entityInitials('   ')).toBe('?');
    expect(entityInitials('', 'X')).toBe('X');
  });

  it('uses first two letters for single word', () => {
    expect(entityInitials('Solea')).toBe('SO');
  });

  it('uses first and last word initials for multi-word names', () => {
    expect(entityInitials('Maria Santos')).toBe('MS');
    expect(entityInitials('  Acme   Stays  PH  ')).toBe('AP');
  });
});

describe('isUsableLogoNaturalSize', () => {
  it('rejects tiny placeholder dimensions', () => {
    expect(isUsableLogoNaturalSize(MIN_ENTITY_LOGO_PX - 1, 100)).toBe(false);
    expect(isUsableLogoNaturalSize(100, MIN_ENTITY_LOGO_PX - 1)).toBe(false);
  });

  it('accepts dimensions at or above minimum', () => {
    expect(isUsableLogoNaturalSize(MIN_ENTITY_LOGO_PX, MIN_ENTITY_LOGO_PX)).toBe(true);
  });
});
