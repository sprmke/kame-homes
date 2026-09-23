import { describe, expect, it } from 'vitest';

import { parseAdminListView } from '@/features/dashboard/bookings/lib/listView';

describe('parseAdminListView', () => {

  it('parseAdminListView is exported', () => {
    expect(typeof parseAdminListView).toBe('function');
  });

});
