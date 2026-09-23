import { describe, expect, it } from 'vitest';

import { mapStayGuideData } from '@/features/guest/stay-guide/lib/mapStayGuideData';

describe('mapStayGuideData', () => {

  it('mapStayGuideData is exported', () => {
    expect(typeof mapStayGuideData).toBe('function');
  });

});
