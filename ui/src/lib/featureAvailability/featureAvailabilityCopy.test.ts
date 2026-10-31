import { describe, expect, it } from 'vitest';

import {
  formatFeatureExpectedBackLabel,
  resolveFeatureAvailabilityMessage,
} from '@/lib/featureAvailability/featureAvailabilityCopy';

describe('formatFeatureExpectedBackLabel', () => {
  const effectiveNow = Date.parse('2026-10-28T10:00:00.000Z');
  const serverSkewMs = effectiveNow - Date.now();

  it('same Manila day shows time only', () => {
    const label = formatFeatureExpectedBackLabel({
      expectedBackAt: '2026-10-28T14:00:00.000Z',
      serverSkewMs,
    });
    expect(label).toMatch(/^Back by /);
    expect(label).toMatch(/PM|AM$/);
  });

  it('other day includes month and day', () => {
    const label = formatFeatureExpectedBackLabel({
      expectedBackAt: '2026-10-30T07:00:00.000Z',
      serverSkewMs,
    });
    expect(label).toContain('Oct 30');
  });

  it('past expected back shows overdue copy', () => {
    const label = formatFeatureExpectedBackLabel({
      expectedBackAt: '2026-10-27T07:00:00.000Z',
      serverSkewMs,
    });
    expect(label).toBe('Taking longer than expected');
  });

  it('returns null when no time set', () => {
    expect(formatFeatureExpectedBackLabel({ expectedBackAt: null, serverSkewMs })).toBeNull();
  });
});

describe('resolveFeatureAvailabilityMessage', () => {
  it('substitutes provider in provider_issue copy', () => {
    const message = resolveFeatureAvailabilityMessage({
      reason: 'provider_issue',
      customMessage: null,
      sourceKey: 'inbox.meta',
    });
    expect(message).toContain('Meta');
  });
});
