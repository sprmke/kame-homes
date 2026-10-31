import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/shims/classnames';

describe('classnames', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
