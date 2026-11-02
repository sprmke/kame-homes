import { describe, expect, it } from 'vitest';

import {
  scrubUrl as clientScrubUrl,
  TELEMETRY_DENY_KEYS as CLIENT_DENY_KEYS,
  TELEMETRY_DENY_QUERY_KEYS as CLIENT_DENY_QUERY_KEYS,
} from '@/lib/telemetry/scrub';

import {
  scrubUrl as edgeScrubUrl,
  TELEMETRY_DENY_KEYS as EDGE_DENY_KEYS,
  TELEMETRY_DENY_QUERY_KEYS as EDGE_DENY_QUERY_KEYS,
} from '../../../../supabase/functions/_shared/telemetryScrub.ts';

/**
 * The browser and edge modules are separate files because edge isolates cannot import
 * from `ui/`. This is the check that stops the two lists drifting apart, which would
 * mean a value scrubbed from a Sentry browser event but sent from an edge event.
 */
describe('telemetry scrub parity', () => {
  it('deny keys match in both orders', () => {
    expect([...CLIENT_DENY_KEYS]).toEqual([...EDGE_DENY_KEYS]);
  });

  it('deny query keys match in both orders', () => {
    expect([...CLIENT_DENY_QUERY_KEYS]).toEqual([...EDGE_DENY_QUERY_KEYS]);
  });

  it('scrubs a token URL the same way on both runtimes', () => {
    const url = 'https://dev.kamehomes.space/sd-form?access=aaa&complete=bbb&token=ccc&tab=review';
    expect(clientScrubUrl(url)).toBe(edgeScrubUrl(url));
    expect(clientScrubUrl(url)).not.toContain('access=');
  });
});
