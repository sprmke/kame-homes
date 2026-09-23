import { describe, expect, it } from 'vitest';

import { useInboxPropertyShareRows, useInboxBookingShareRows } from '@/features/dashboard/inbox/lib/inboxBookingShareRows';

describe('useInboxPropertyShareRows', () => {

  it('useInboxPropertyShareRows is exported', () => {
    expect(typeof useInboxPropertyShareRows).toBe('function');
  });

});

describe('useInboxBookingShareRows', () => {

  it('useInboxBookingShareRows is exported', () => {
    expect(typeof useInboxBookingShareRows).toBe('function');
  });

});
