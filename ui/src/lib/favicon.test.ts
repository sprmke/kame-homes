import { describe, expect, it } from 'vitest';

import { useFavicon } from '@/lib/favicon';

describe('useFavicon', () => {

  it('useFavicon is exported', () => {
    expect(typeof useFavicon).toBe('function');
  });

});
