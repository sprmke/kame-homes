import { describe, expect, it } from 'vitest';

import { mapShowcaseData } from '@/features/guest/marketing/showcase/lib/mapShowcaseData';

describe('mapShowcaseData', () => {

  it('mapShowcaseData is exported', () => {
    expect(typeof mapShowcaseData).toBe('function');
  });

});
