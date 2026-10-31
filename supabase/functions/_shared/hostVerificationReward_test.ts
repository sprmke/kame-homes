/**
 * Deno tests for host verification reward helpers.
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { isHostRewardCampaignOpen } from './hostVerificationReward.ts';

function settings(partial: {
  campaignStart?: string | null;
  campaignEnd?: string | null;
}) {
  return {
    enabled: true,
    planCode: 'growth',
    durationDays: 30,
    trigger: 'recommended_verification_approved' as const,
    campaignStart: partial.campaignStart ?? null,
    campaignEnd: partial.campaignEnd ?? null,
    maxPerOrg: 1,
    applyToPaidOrg: 'skip' as const,
  };
}

Deno.test('isHostRewardCampaignOpen: open when both bounds null', () => {
  assertEquals(
    isHostRewardCampaignOpen(settings({}), new Date('2026-06-01T00:00:00Z')),
    true,
  );
});

Deno.test('isHostRewardCampaignOpen: closed before start', () => {
  assertEquals(
    isHostRewardCampaignOpen(
      settings({ campaignStart: '2026-07-01T00:00:00Z' }),
      new Date('2026-06-01T00:00:00Z'),
    ),
    false,
  );
});

Deno.test('isHostRewardCampaignOpen: closed after end', () => {
  assertEquals(
    isHostRewardCampaignOpen(
      settings({ campaignEnd: '2026-05-01T00:00:00Z' }),
      new Date('2026-06-01T00:00:00Z'),
    ),
    false,
  );
});

Deno.test('isHostRewardCampaignOpen: open inside window', () => {
  assertEquals(
    isHostRewardCampaignOpen(
      settings({
        campaignStart: '2026-01-01T00:00:00Z',
        campaignEnd: '2026-12-31T00:00:00Z',
      }),
      new Date('2026-06-01T00:00:00Z'),
    ),
    true,
  );
});
