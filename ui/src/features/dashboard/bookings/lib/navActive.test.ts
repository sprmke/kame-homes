import { describe, expect, it } from 'vitest';

import { resolveActiveNavHref } from '@/features/dashboard/bookings/lib/navActive';

describe('resolveActiveNavHref', () => {
  it('returns null when no href matches', () => {
    expect(resolveActiveNavHref('/org/acme/settings', ['/org/acme/bookings'])).toBeNull();
  });

  it('picks longest matching prefix', () => {
    const hrefs = ['/org/acme', '/org/acme/property/p1/bookings', '/org/acme/property/p1'];
    expect(resolveActiveNavHref('/org/acme/property/p1/bookings/123', hrefs)).toBe(
      '/org/acme/property/p1/bookings'
    );
  });
});
