import { describe, expect, it } from 'vitest';

import { formatBriefingDelta } from '@/features/dashboard/ai-assistant/lib/briefingDelta';

describe('formatBriefingDelta', () => {
  it('returns empty when every count is zero', () => {
    expect(formatBriefingDelta({ newBookings: 0, newMessages: 0, completedStays: 0 })).toBe('');
  });

  it('joins only the counts that changed', () => {
    expect(formatBriefingDelta({ newBookings: 3, newMessages: 1, completedStays: 0 })).toBe(
      'Since yesterday: 3 bookings, 1 message'
    );
  });
});
