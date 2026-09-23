import { describe, expect, it } from 'vitest';

import { safeRedirect } from '@/features/guest/auth/lib/authRedirect';

describe('safeRedirect', () => {

  it('safeRedirect is exported', () => {
    expect(typeof safeRedirect).toBe('function');
  });

});
