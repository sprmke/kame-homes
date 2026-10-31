import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/pwa/push';

describe('push', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
