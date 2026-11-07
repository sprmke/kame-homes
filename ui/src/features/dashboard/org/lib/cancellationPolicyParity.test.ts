import { describe, expect, it } from 'vitest';

import * as client from '@/features/dashboard/org/lib/cancellationPolicy';
import * as server from '../../../../../../supabase/functions/_shared/cancellationPolicy';

const RAW_INPUTS: unknown[] = [
  undefined,
  null,
  {},
  { type: 'grace_period', gracePeriodHours: 48 },
  { type: 'full_before_checkin', daysBeforeCheckIn: 7 },
  { type: 'moderate', gracePeriodHours: 72, daysBeforeCheckIn: 5 },
  { type: 'partial_before_checkin', daysBeforeCheckIn: 14, partialRefundPercent: 50 },
  { type: 'non_refundable' },
  { type: 'custom', customTitle: 'Ask us', customDescription: 'Message us.' },
  client.buildCancellationPreset('flexible'),
  client.buildCancellationPreset('moderate'),
  client.buildCancellationPreset('firm'),
  client.buildCancellationPreset('standard'),
  client.buildCancellationPreset('non_refundable'),
  client.buildCancellationPreset('custom', {
    tiers: [
      { daysBefore: 30, refundPercent: 100 },
      { daysBefore: 7, refundPercent: 50 },
      { daysBefore: 2, refundPercent: 25 },
    ],
    fallbackRefundPercent: 0,
  }),
];

describe('cancellation policy client/server parity', () => {
  it('normalizes every stored shape identically', () => {
    for (const raw of RAW_INPUTS) {
      expect(client.normalizeCancellationPolicy(raw)).toEqual(
        server.normalizeCancellationPolicy(raw)
      );
    }
  });

  it('renders the same display for every shape', () => {
    for (const raw of RAW_INPUTS) {
      expect(client.resolveCancellationPolicyDisplay(raw)).toEqual(
        server.resolveCancellationPolicyDisplay(raw)
      );
    }
  });

  it('validates identically', () => {
    for (const raw of RAW_INPUTS) {
      expect(client.validateCancellationPolicy(raw)).toBe(server.validateCancellationPolicy(raw));
    }
  });

  it('hashes identically', () => {
    for (const raw of RAW_INPUTS) {
      const policy = client.normalizeCancellationPolicy(raw);
      expect(client.cancellationPolicyHash(policy)).toBe(server.cancellationPolicyHash(policy));
    }
  });

  it('builds identical snapshots', () => {
    const policy = client.buildCancellationPreset('firm');
    const capturedAt = '2026-11-05T00:00:00.000Z';
    expect(
      client.buildCancellationPolicySnapshot({
        policy,
        capturedFrom: 'guest_form',
        propertyPolicyVersionId: 'v1',
        capturedAt,
      })
    ).toEqual(
      server.buildCancellationPolicySnapshot({
        policy,
        capturedFrom: 'guest_form',
        propertyPolicyVersionId: 'v1',
        capturedAt,
      })
    );
  });
});
