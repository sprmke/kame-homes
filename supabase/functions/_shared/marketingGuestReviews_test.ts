/**
 * Marketing guest-review helpers — unit tests.
 * Run: deno test --allow-env supabase/functions/_shared/marketingGuestReviews_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  filterMarketingGuestReviews,
  formatReviewAttribution,
  marketingSocialSeedAllowed,
  toMarketingGuestReviewDto,
  truncateReviewQuote,
  type MarketingGuestReviewDto,
} from './marketingGuestReviews.ts';
import type { PublicGuestReviewDto } from './guestReviewService.ts';

function review(
  partial: Partial<MarketingGuestReviewDto> & Pick<MarketingGuestReviewDto, 'id' | 'source'>
): MarketingGuestReviewDto {
  return {
    author: 'Guest',
    date: 'August 2026',
    rating: 5,
    comment: 'Loved it',
    feedbackTags: [],
    media: [],
    createdAt: '2026-08-01T00:00:00Z',
    socialSeedAllowed: marketingSocialSeedAllowed(partial.source),
    ...partial,
  };
}

Deno.test('socialSeedAllowed: kame + facebook yes, airbnb no', () => {
  assertEquals(marketingSocialSeedAllowed('kame'), true);
  assertEquals(marketingSocialSeedAllowed('facebook'), true);
  assertEquals(marketingSocialSeedAllowed('airbnb'), false);
});

Deno.test('toMarketingGuestReviewDto defaults missing source to kame', () => {
  const dto: PublicGuestReviewDto = {
    id: '1',
    author: 'A',
    date: 'August 2026',
    rating: 5,
    comment: 'Nice',
    feedbackTags: [],
    media: [],
    createdAt: '2026-08-01T00:00:00Z',
  };
  const marketing = toMarketingGuestReviewDto(dto);
  assertEquals(marketing.source, 'kame');
  assertEquals(marketing.socialSeedAllowed, true);
});

Deno.test('filterMarketingGuestReviews applies minRating, source, socialSeedOnly, limit', () => {
  const rows = [
    review({ id: 'a', source: 'kame', rating: 5, createdAt: '2026-08-03T00:00:00Z' }),
    review({ id: 'b', source: 'airbnb', rating: 5, createdAt: '2026-08-02T00:00:00Z' }),
    review({ id: 'c', source: 'facebook', rating: 3, createdAt: '2026-08-01T00:00:00Z' }),
    review({ id: 'd', source: 'kame', rating: 4, createdAt: '2026-07-01T00:00:00Z' }),
  ];

  const fourPlus = filterMarketingGuestReviews(rows, { minRating: 4 });
  assertEquals(
    fourPlus.map((r) => r.id),
    ['a', 'b', 'd']
  );

  const seedOnly = filterMarketingGuestReviews(rows, { minRating: 4, socialSeedOnly: true });
  assertEquals(
    seedOnly.map((r) => r.id),
    ['a', 'd']
  );

  const facebook = filterMarketingGuestReviews(rows, { source: 'facebook' });
  assertEquals(
    facebook.map((r) => r.id),
    ['c']
  );

  const limited = filterMarketingGuestReviews(rows, { minRating: 4, limit: 1 });
  assertEquals(limited.length, 1);
  assertEquals(limited[0].id, 'a');
});

Deno.test('truncateReviewQuote respects word boundary', () => {
  const long = 'This stay felt like home every single morning by the pool.';
  const cut = truncateReviewQuote(long, 30);
  assertEquals(cut.endsWith('…'), true);
  assertEquals(cut.includes('morning'), false);
});

Deno.test('formatReviewAttribution', () => {
  assertEquals(formatReviewAttribution('Maria', 'August 2026'), '— Maria · August 2026');
  assertEquals(formatReviewAttribution('  ', ''), '— Guest');
});
