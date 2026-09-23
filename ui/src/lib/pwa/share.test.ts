import { describe, expect, it } from 'vitest';

import { canWebShare } from '@/lib/pwa/share';

describe('canWebShare', () => {

  it('canWebShare is exported', () => {
    expect(typeof canWebShare).toBe('function');
  });

});
