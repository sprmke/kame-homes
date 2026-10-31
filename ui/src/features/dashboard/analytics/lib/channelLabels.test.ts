import { describe, expect, it } from 'vitest';

import { prettyChannelLabel } from '@/features/dashboard/analytics/lib/channelLabels';

describe('prettyChannelLabel', () => {
  it('rolls Direct aliases into one label', () => {
    expect(prettyChannelLabel('Direct')).toBe('Direct');
    expect(prettyChannelLabel('direct')).toBe('Direct');
    expect(prettyChannelLabel('website')).toBe('Direct');
  });

  it('labels known OTAs', () => {
    expect(prettyChannelLabel('airbnb')).toBe('Airbnb');
    expect(prettyChannelLabel('booking')).toBe('Booking.com');
    expect(prettyChannelLabel('tiktok')).toBe('TikTok');
  });

  it('handles empty and unknown slugs', () => {
    expect(prettyChannelLabel(null)).toBe('Unknown');
    expect(prettyChannelLabel('')).toBe('Unknown');
    expect(prettyChannelLabel('marketing_review_seed')).toBe('Marketing Review Seed');
  });
});
