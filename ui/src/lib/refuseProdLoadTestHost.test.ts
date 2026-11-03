import { describe, expect, it } from 'vitest';

import {
  REFUSED_LOAD_TEST_HOSTS,
  refuseProdLoadTestBaseUrl,
} from '../../../scripts/performance/load-test/refuseProdHost.mjs';

describe('refuseProdLoadTestBaseUrl', () => {
  it('refuses production and legacy prod hosts', () => {
    for (const host of REFUSED_LOAD_TEST_HOSTS) {
      expect(() => refuseProdLoadTestBaseUrl(`https://${host}/`)).toThrow(/Refusing/);
    }
  });

  it('allows hosted dev hosts', () => {
    expect(() => refuseProdLoadTestBaseUrl('https://dev.kamespace.com/')).not.toThrow();
    expect(() => refuseProdLoadTestBaseUrl('https://dev.kamespace.com/')).not.toThrow();
  });
});
