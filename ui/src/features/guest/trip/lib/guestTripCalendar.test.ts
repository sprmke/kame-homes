import { describe, expect, it } from 'vitest';

import { buildGuestTripIcs, manilaToIcsUtc } from '@/features/guest/trip/lib/guestTripCalendar';

describe('manilaToIcsUtc', () => {
  it('converts Manila wall-clock to UTC', () => {
    expect(manilaToIcsUtc('2026-10-10', '14:00', '14:00')).toBe('20261010T060000Z');
  });

  it('crosses midnight back into the previous UTC day', () => {
    expect(manilaToIcsUtc('2026-11-01', '07:30', '11:00')).toBe('20261031T233000Z');
  });

  it('uses the fallback time when the booking time is missing', () => {
    expect(manilaToIcsUtc('2026-10-12', null, '11:00')).toBe('20261012T030000Z');
  });
});

describe('buildGuestTripIcs', () => {
  it('builds one escaped VEVENT for the stay', () => {
    const ics = buildGuestTripIcs({
      bookingId: 'abc',
      propertyName: 'Azure, North; 1BR',
      checkInDate: '2026-10-10',
      checkOutDate: '2026-10-12',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      address: 'San Fernando, Pampanga',
      tripUrl: 'https://kamehomes.space/properties/azure/trip?bookingId=abc',
      now: new Date('2026-10-05T00:00:00Z'),
    });
    expect(ics).toContain('DTSTART:20261010T060000Z');
    expect(ics).toContain('DTEND:20261012T030000Z');
    expect(ics).toContain('SUMMARY:Stay at Azure\\, North\\; 1BR');
    expect(ics).toContain('LOCATION:San Fernando\\, Pampanga');
    expect(ics).toContain('UID:trip-abc@kamehomes');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toContain('access=');
  });
});
