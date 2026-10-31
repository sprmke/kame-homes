import { describe, expect, it } from 'vitest';

import { bookingDetailHref } from '@/features/dashboard/ai-assistant/lib/assistantEntityLinks';

describe('bookingDetailHref', () => {
  const properties = [{ id: 'p1', slug: 'loft' }];
  const parkings = [{ id: 'k1', slug: 'slot-a' }];

  it('links property and parking bookings', () => {
    expect(
      bookingDetailHref({ orgSlug: 'acme', bookingId: 'b1', propertyId: 'p1', properties })
    ).toBe('/org/acme/property/loft/bookings/b1');
    expect(bookingDetailHref({ orgSlug: 'acme', bookingId: 'b1', parkingId: 'k1', parkings })).toBe(
      '/org/acme/parking/slot-a/bookings/b1'
    );
  });

  it('returns null when the listing is unknown or ids are missing', () => {
    expect(
      bookingDetailHref({ orgSlug: 'acme', bookingId: 'b1', propertyId: 'x', properties })
    ).toBeNull();
    expect(bookingDetailHref({ orgSlug: null, bookingId: 'b1', propertyId: 'p1' })).toBeNull();
    expect(bookingDetailHref({ orgSlug: 'acme', bookingId: 'b1' })).toBeNull();
  });
});
