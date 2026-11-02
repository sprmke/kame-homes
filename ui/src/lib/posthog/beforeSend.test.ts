import { describe, expect, it } from 'vitest';

import { scrubPostHogEvent } from './beforeSend';

function event(properties: Record<string, unknown>) {
  return { event: '$pageview', properties };
}

describe('scrubPostHogEvent', () => {
  it('removes capability tokens from every URL property', () => {
    const out = scrubPostHogEvent(
      event({
        $current_url: 'https://dev.kamehomes.space/sd-form?access=aaa&tab=review',
        $initial_current_url: 'https://dev.kamehomes.space/form?token=bbb',
        $referrer: 'https://dev.kamehomes.space/complete?complete=ccc',
        $initial_referrer: 'https://dev.kamehomes.space/p?t=ddd&keep=1',
      })
    );

    const props = out!.properties!;
    expect(props.$current_url).toBe('https://dev.kamehomes.space/sd-form?tab=review');
    expect(props.$initial_current_url).toBe('https://dev.kamehomes.space/form');
    expect(props.$referrer).toBe('https://dev.kamehomes.space/complete');
    expect(props.$initial_referrer).toBe('https://dev.kamehomes.space/p?keep=1');
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
