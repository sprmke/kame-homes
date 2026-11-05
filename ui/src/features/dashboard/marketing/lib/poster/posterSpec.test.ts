import { describe, expect, it } from 'vitest';

import {
  compactPosterPhotos,
  normalizePosterSpec,
  type PosterFacts,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

const FACTS: PosterFacts = {
  propertyName: 'Sunset Loft',
  brandName: 'Kame',
  location: 'Makati',
  checkIn: '3:00 PM',
  checkOut: '11:00 AM',
  securityDeposit: null,
  nightlyRate: null,
  amenities: [],
  logoUrl: null,
  photos: Array.from({ length: 10 }, (_, index) => `https://cdn.test/p${index}.jpg`),
};

function spec(photoIndexes: number[]) {
  return normalizePosterSpec({ archetype: 'sky-headline', photoIndexes }, FACTS);
}

describe('compactPosterPhotos', () => {
  it('keeps only the photos the post places, in order', () => {
    const result = compactPosterPhotos(spec([4, 2]), FACTS.photos);
    expect(result.photoUrls).toEqual(['https://cdn.test/p4.jpg', 'https://cdn.test/p2.jpg']);
    expect(result.spec.photoIndexes).toEqual([0, 1]);
  });

  it('drops indexes with no photo behind them', () => {
    const result = compactPosterPhotos(spec([1]), []);
    expect(result.photoUrls).toEqual([]);
    expect(result.spec.photoIndexes).toEqual([]);
  });

  it('points repeats at the same photo', () => {
    const raw = { ...spec([3]), photoIndexes: [3, 3, 5] };
    const result = compactPosterPhotos(raw, FACTS.photos);
    expect(result.photoUrls).toEqual(['https://cdn.test/p3.jpg', 'https://cdn.test/p5.jpg']);
    expect(result.spec.photoIndexes).toEqual([0, 0, 1]);
  });

  it('leaves the rest of the spec alone', () => {
    const original = spec([0]);
    const result = compactPosterPhotos(original, FACTS.photos);
    expect({ ...result.spec, photoIndexes: null }).toEqual({ ...original, photoIndexes: null });
  });
});
