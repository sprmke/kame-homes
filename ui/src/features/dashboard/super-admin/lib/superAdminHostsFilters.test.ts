import { describe, expect, it } from 'vitest';

import { superAdminHostsHasActiveFilters, hostDisplayInitial } from '@/features/dashboard/super-admin/lib/superAdminHostsFilters';

describe('superAdminHostsHasActiveFilters', () => {

  it('superAdminHostsHasActiveFilters is exported', () => {
    expect(typeof superAdminHostsHasActiveFilters).toBe('function');
  });

});

describe('hostDisplayInitial', () => {

  it('hostDisplayInitial is exported', () => {
    expect(typeof hostDisplayInitial).toBe('function');
  });

});
