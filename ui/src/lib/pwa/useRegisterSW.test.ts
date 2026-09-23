import { describe, expect, it } from 'vitest';

import { useRegisterSW } from '@/lib/pwa/useRegisterSW';

describe('useRegisterSW', () => {

  it('useRegisterSW is exported', () => {
    expect(typeof useRegisterSW).toBe('function');
  });

});
