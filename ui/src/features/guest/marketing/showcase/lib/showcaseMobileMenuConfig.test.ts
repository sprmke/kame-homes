import { describe, expect, it } from 'vitest';

import * as mod from '@/features/guest/marketing/showcase/lib/showcaseMobileMenuConfig';

describe('showcaseMobileMenuConfig', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
