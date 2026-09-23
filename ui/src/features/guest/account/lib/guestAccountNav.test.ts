import { describe, expect, it } from 'vitest';

import { resolveGuestAccountNavItem } from '@/features/guest/account/lib/guestAccountNav';

describe('resolveGuestAccountNavItem', () => {

  it('resolveGuestAccountNavItem is exported', () => {
    expect(typeof resolveGuestAccountNavItem).toBe('function');
  });

});
