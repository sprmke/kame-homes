import { describe, expect, it } from 'vitest';

import { scrubPostHogEvent } from './beforeSend';

function event(properties: Record<string, unknown>) {
  return { event: '$pageview', properties };
}

describe('scrubPostHogEvent', () => {
  it('removes capability tokens from every URL property', () => {
    const out = scrubPostHogEvent(
      event({
        $current_url: 'https://dev.kamespace.com/sd-form?access=aaa&tab=review',
        $initial_current_url: 'https://dev.kamespace.com/form?token=bbb',
        $referrer: 'https://dev.kamespace.com/complete?complete=ccc',
        $initial_referrer: 'https://dev.kamespace.com/p?t=ddd&keep=1',
      })
    );

    const props = out!.properties!;
    expect(props.$current_url).toBe('https://dev.kamespace.com/sd-form?tab=review');
    expect(props.$initial_current_url).toBe('https://dev.kamespace.com/form');
    expect(props.$referrer).toBe('https://dev.kamespace.com/complete');
    expect(props.$initial_referrer).toBe('https://dev.kamespace.com/p?keep=1');
  });

  it('keeps non-URL properties untouched', () => {
    const out = scrubPostHogEvent(event({ plan_tier: 'pro', org_id: 'org-1' }));
    expect(out!.properties).toEqual({ plan_tier: 'pro', org_id: 'org-1' });
  });

  it('tolerates a missing properties bag', () => {
    expect(scrubPostHogEvent({ event: 'custom' })).toEqual({ event: 'custom' });
  });

  it('drops the event rather than shipping it when scrubbing throws', () => {
    const hostile = {
      event: '$pageview',
      get properties(): Record<string, unknown> {
        throw new Error('boom');
      },
    } as unknown as { event: string; properties?: Record<string, unknown> };

    expect(scrubPostHogEvent(hostile)).toBeNull();
  });
});

describe('performance events belong to Sentry', () => {
  it('drops web vitals events, whatever the project setting says', () => {
    // The project's remote config re-enables vitals over the client flag, so the drop has to
    // happen here or PostHog becomes a second source of truth for LCP/INP/CLS.
    expect(scrubPostHogEvent({ event: '$web_vitals', properties: {} })).toBeNull();
    expect(scrubPostHogEvent({ event: '$web_vitals_lcp_event', properties: {} })).toBeNull();
  });

  it('keeps ordinary product events', () => {
    expect(scrubPostHogEvent({ event: 'listing_viewed', properties: {} })).not.toBeNull();
  });
});
