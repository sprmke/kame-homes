import { describe, expect, it } from 'vitest';

import { aiReliabilityChecks } from '@/features/dashboard/super-admin/lib/systemHealth/aiReliability';

const row = (feature: string, calls: number, errorRatePct: number, fallbackRatePct: number) => ({
  feature,
  costUsd: 0,
  calls,
  errors: 0,
  errorRatePct,
  fallbackRatePct,
  latencyP50Ms: null,
  latencyP95Ms: null,
});

describe('aiReliabilityChecks', () => {
  it('skips low-volume features', () => {
    expect(aiReliabilityChecks([row('a', 5, 50, 50)])).toEqual([]);
  });

  it('warns on high error or fallback rate', () => {
    const checks = aiReliabilityChecks([
      row('ok', 100, 1, 5),
      row('errors', 100, 15, 0),
      row('fallback', 100, 0, 30),
    ]);
    expect(checks.map((c) => c.status)).toEqual(['ok', 'warn', 'warn']);
  });
});
