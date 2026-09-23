import { describe, expect, it } from 'vitest';

import { superAdminDevelopmentSlugFromPath, superAdminHostIdFromPath, superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

describe('superAdminDevelopmentSlugFromPath', () => {

  it('superAdminDevelopmentSlugFromPath is exported', () => {
    expect(typeof superAdminDevelopmentSlugFromPath).toBe('function');
  });

});

describe('superAdminHostIdFromPath', () => {

  it('superAdminHostIdFromPath is exported', () => {
    expect(typeof superAdminHostIdFromPath).toBe('function');
  });

});

describe('superAdminPaths', () => {
  it('is defined', () => {
    expect(superAdminPaths).toBeDefined();
  });
});
