import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/pwa/outbox';

describe('outbox', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
