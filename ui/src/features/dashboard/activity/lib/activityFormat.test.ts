import { describe, expect, it } from 'vitest';

import {
  activityAbsoluteTime,
  activityRelativeTime,
  changeSummary,
  formatChangeValue,
  humanizeAction,
} from '@/features/dashboard/activity/lib/activityFormat';

describe('activityFormat', () => {
  it('humanizes action keys', () => {
    expect(humanizeAction('booking.status_changed')).toBe('Booking · Status Changed');
  });

  it('formats change values', () => {
    expect(formatChangeValue(null)).toBe('—');
    expect(formatChangeValue(true)).toBe('Yes');
    expect(formatChangeValue({ a: 1 })).toBe('{"a":1}');
  });

  it('summarizes field changes', () => {
    expect(changeSummary([])).toBe('');
    expect(
      changeSummary([
        { field: 'status', from: 'a', to: 'b' },
        { field: 'guest_email', from: 'x', to: 'y' },
      ])
    ).toBe('status, guest email');
    expect(
      changeSummary([
        { field: 'a', from: 1, to: 2 },
        { field: 'b', from: 1, to: 2 },
        { field: 'c', from: 1, to: 2 },
        { field: 'd', from: 1, to: 2 },
      ])
    ).toContain('+1 more');
  });

  it('formats relative and absolute timestamps', () => {
    const iso = '2020-01-01T00:00:00.000Z';
    expect(activityRelativeTime(iso)).toMatch(/ago$/);
    expect(activityAbsoluteTime(iso).length).toBeGreaterThan(5);
  });
});
