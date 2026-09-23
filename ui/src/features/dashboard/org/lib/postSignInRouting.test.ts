import { describe, expect, it } from 'vitest';

import { mapLegacyAdminPath } from '@/features/dashboard/org/lib/postSignInRouting';

describe('mapLegacyAdminPath', () => {

  it('mapLegacyAdminPath is exported', () => {
    expect(typeof mapLegacyAdminPath).toBe('function');
  });

});
