import { describe, expect, it } from 'vitest';

import { buildPropertyGuestPublicPages } from '@/features/dashboard/property/lib/propertyGuestPublicPages';

describe('buildPropertyGuestPublicPages', () => {

  it('buildPropertyGuestPublicPages is exported', () => {
    expect(typeof buildPropertyGuestPublicPages).toBe('function');
  });

});
