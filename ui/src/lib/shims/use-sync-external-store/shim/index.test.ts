import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/shims/use-sync-external-store/shim/index';

describe('index', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
