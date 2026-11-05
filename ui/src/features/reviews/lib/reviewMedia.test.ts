import { describe, expect, it } from 'vitest';

import { normalizeReviewMedia } from '@/features/reviews/lib/reviewMedia';

describe('normalizeReviewMedia', () => {
  it('returns an empty list for non-array JSONB', () => {
    expect(normalizeReviewMedia(null)).toEqual([]);
    expect(normalizeReviewMedia(undefined)).toEqual([]);
    expect(normalizeReviewMedia({})).toEqual([]);
    expect(normalizeReviewMedia('https://x/y.jpg')).toEqual([]);
  });

  it('keeps well-formed entries and defaults the type to image', () => {
    expect(
      normalizeReviewMedia([
        { url: 'https://x/a.jpg', type: 'image' },
        { url: 'https://x/b.mp4', type: 'video' },
        { url: 'https://x/c.jpg' },
      ])
    ).toEqual([
      { url: 'https://x/a.jpg', type: 'image' },
      { url: 'https://x/b.mp4', type: 'video' },
      { url: 'https://x/c.jpg', type: 'image' },
    ]);
  });

  it('accepts legacy string rows', () => {
    expect(normalizeReviewMedia([' https://x/a.jpg '])).toEqual([
      { url: 'https://x/a.jpg', type: 'image' },
    ]);
  });

  it('drops entries without a usable url', () => {
    expect(normalizeReviewMedia([{ type: 'image' }, { url: '   ' }, 42, null, ''])).toEqual([]);
  });
});
