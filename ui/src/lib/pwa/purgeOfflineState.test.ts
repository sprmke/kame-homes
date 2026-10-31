import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/pwa/purgeOfflineState';

describe('purgeOfflineState', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
