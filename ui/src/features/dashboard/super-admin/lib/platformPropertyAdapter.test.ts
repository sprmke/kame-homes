import { describe, expect, it } from 'vitest';

import { platformPropertyToProperty } from '@/features/dashboard/super-admin/lib/platformPropertyAdapter';

describe('platformPropertyToProperty', () => {

  it('platformPropertyToProperty is exported', () => {
    expect(typeof platformPropertyToProperty).toBe('function');
  });

});
