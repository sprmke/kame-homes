import { describe, expect, it } from 'vitest';

import {
  countParkingStayNights,
  formatParkingBroadcastCountdown,
  formatParkingStayRange,
  parkingBroadcastCountdownA11yLabel,
} from '@/utils/format/parkingStayDisplay';

describe('parkingStayDisplay', () => {
  it('formats stay range when dates valid', () => {
    const range = formatParkingStayRange('2026-09-24', '2026-09-28');
    expect(range).toBeTruthy();
  });

  it('counts nights between check-in and check-out', () => {
    expect(countParkingStayNights('2026-09-24', '2026-09-26')).toBe(2);
    expect(countParkingStayNights('', '2026-09-26')).toBeNull();
  });

  it('formats broadcast countdown tiers', () => {
    expect(formatParkingBroadcastCountdown(45_000)).toBe('0:45');
    expect(formatParkingBroadcastCountdown(3_600_000)).toMatch(/1h/);
    expect(formatParkingBroadcastCountdown(90_000_000)).toMatch(/d/);
  });

  it('a11y countdown labels', () => {
    expect(parkingBroadcastCountdownA11yLabel(30_000)).toBe('Less than a minute remaining');
    expect(parkingBroadcastCountdownA11yLabel(120_000)).toBe('2 minutes remaining');
  });
});

