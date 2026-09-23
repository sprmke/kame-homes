import { describe, expect, it } from 'vitest';

import { useAdminLayoutFillMain, useAdminLayoutIsFillMain, AdminLayoutFillMainContext, AdminLayoutFillMainActiveContext } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';

describe('useAdminLayoutFillMain', () => {

  it('useAdminLayoutFillMain is exported', () => {
    expect(typeof useAdminLayoutFillMain).toBe('function');
  });

});

describe('useAdminLayoutIsFillMain', () => {

  it('useAdminLayoutIsFillMain is exported', () => {
    expect(typeof useAdminLayoutIsFillMain).toBe('function');
  });

});

describe('AdminLayoutFillMainContext', () => {
  it('is defined', () => {
    expect(AdminLayoutFillMainContext).toBeDefined();
  });
});

describe('AdminLayoutFillMainActiveContext', () => {
  it('is defined', () => {
    expect(AdminLayoutFillMainActiveContext).toBeDefined();
  });
});
