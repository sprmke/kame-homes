import { describe, expect, it } from 'vitest';

import { inboxFiltersBlockMetaScrollSync, inboxPageExhaustedInDb } from '@/features/dashboard/inbox/lib/inboxThreadPagination';

describe('inboxFiltersBlockMetaScrollSync', () => {

  it('inboxFiltersBlockMetaScrollSync is exported', () => {
    expect(typeof inboxFiltersBlockMetaScrollSync).toBe('function');
  });

});

describe('inboxPageExhaustedInDb', () => {

  it('inboxPageExhaustedInDb is exported', () => {
    expect(typeof inboxPageExhaustedInDb).toBe('function');
  });

});
