import { describe, expect, it } from 'vitest';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';
import { applyGuestReviewToVideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/applyGuestReviewToVideoProjectV2';
import { migrateVideoProjectV1 } from '@/features/dashboard/marketing/lib/video/v2/migrateVideoProjectV1';
import { isLayerItem } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { song, track } from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';
import { buildDefaultVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';

const binding: DesignBinding = {
  propertyName: 'Casa',
  propertyPhoto: 'https://x/p.jpg',
  propertyMedia: [{ url: 'https://x/p.jpg', type: 'image' }],
  nightlyRate: '₱2,799 / night',
  availabilityText: '',
  monthLabel: 'June 2026',
  monthShort: 'June',
  openSlots: [],
};

const review = (over: Partial<MarketingGuestReview> = {}): MarketingGuestReview => ({
  id: 'rev-1',
  author: 'Ana',
  date: '2026-05-01',
  rating: 5,
  comment: 'Quiet, clean and exactly as pictured.',
  feedbackTags: [],
  media: [],
  source: 'kame',
  createdAt: null,
  socialSeedAllowed: true,
  ...over,
});

describe('applyGuestReviewToVideoProjectV2', () => {
  const base = migrateVideoProjectV1(
    buildDefaultVideoProject('guest-love', 'reviews', binding, 'instagram-story')
  );

  it('writes the review quote into a text clip and records the review id', () => {
    const next = applyGuestReviewToVideoProjectV2(base, review(), binding);
    const texts = next.tracks
      .flatMap((t) => t.items)
      .filter(isLayerItem)
      .map((item) => item.layer.text ?? '');
    expect(texts.some((t) => t.includes('Quiet, clean'))).toBe(true);
    expect(next.sourceReviewId).toBe('rev-1');
    expect(next.format).toBe(base.format);
  });

  it('keeps the host audio tracks', () => {
    const withAudio = { ...base, tracks: [...base.tracks, track('audio', [song(0, 90)])] };
    const next = applyGuestReviewToVideoProjectV2(withAudio, review(), binding);
    expect(next.tracks.filter((t) => t.kind === 'audio')).toHaveLength(1);
  });

  it('does nothing when the review is not cleared for social use', () => {
    const next = applyGuestReviewToVideoProjectV2(
      base,
      review({ socialSeedAllowed: false }),
      binding
    );
    expect(next).toBe(base);
  });

  it('switches a non-review template to Guest love', () => {
    const other = migrateVideoProjectV1(
      buildDefaultVideoProject('quiet-morning', 'soft-stay', binding, 'instagram-story')
    );
    expect(applyGuestReviewToVideoProjectV2(other, review(), binding).templateId).toBe(
      'guest-love'
    );
  });
});
