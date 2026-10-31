import { describe, expect, it } from 'vitest';

import { APP_ANALYTICS_EVENTS, isAppAnalyticsEventName } from '@/lib/posthog/catalog';

describe('posthog catalog', () => {
  it('uses unique snake_case event names', () => {
    const names = new Set(APP_ANALYTICS_EVENTS);
    expect(names.size).toBe(APP_ANALYTICS_EVENTS.length);
    for (const name of APP_ANALYTICS_EVENTS) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(isAppAnalyticsEventName(name)).toBe(true);
    }
  });

  it('rejects unknown names at the type guard', () => {
    expect(isAppAnalyticsEventName('not_a_real_event')).toBe(false);
  });
});
