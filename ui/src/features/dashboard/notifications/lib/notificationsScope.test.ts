import { describe, expect, it } from 'vitest';

import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';

describe('useNotificationsOrgScope', () => {

  it('useNotificationsOrgScope is exported', () => {
    expect(typeof useNotificationsOrgScope).toBe('function');
  });

});
