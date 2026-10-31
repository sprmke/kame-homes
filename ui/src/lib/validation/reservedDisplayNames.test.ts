import { describe, expect, it } from 'vitest';

import {
  collapseDisplayNameAlphanumeric,
  getReservedDisplayNameViolation,
  RESERVED_DISPLAY_NAME_MESSAGE,
} from '@/lib/validation/reservedDisplayNames';

describe('collapseDisplayNameAlphanumeric', () => {
  it('lowercases and strips non-alphanumeric', () => {
    expect(collapseDisplayNameAlphanumeric('Azure North!')).toBe('azurenorth');
  });
});

describe('getReservedDisplayNameViolation', () => {
  it('allows normal names', () => {
    expect(getReservedDisplayNameViolation('Solea Mactan')).toBeNull();
  });

  it('blocks official token', () => {
    expect(getReservedDisplayNameViolation('Azure Official Host')).toBe(
      RESERVED_DISPLAY_NAME_MESSAGE
    );
  });

  it('blocks collapsed reserved names', () => {
    expect(getReservedDisplayNameViolation('Azure North Residences')).toBe(
      RESERVED_DISPLAY_NAME_MESSAGE
    );
  });
});
