import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/shims/use-sync-external-store/shim/withSelector';

describe('withSelector', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
