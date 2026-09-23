import { describe, expect, it } from 'vitest';

import { planTierIcon, planTierIconWellClass } from '@/features/dashboard/plans/lib/planTierIcons';

describe('planTierIcon', () => {

  it('planTierIcon is exported', () => {
    expect(typeof planTierIcon).toBe('function');
  });

});

describe('planTierIconWellClass', () => {

  it('planTierIconWellClass is exported', () => {
    expect(typeof planTierIconWellClass).toBe('function');
  });

});
