import { describe, expect, it } from 'vitest';

import { hostPropertyToProperty } from '@/features/dashboard/super-admin/lib/hostPropertyAdapter';

describe('hostPropertyToProperty', () => {

  it('hostPropertyToProperty is exported', () => {
    expect(typeof hostPropertyToProperty).toBe('function');
  });

});
