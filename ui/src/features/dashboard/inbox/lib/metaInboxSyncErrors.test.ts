import { describe, expect, it } from 'vitest';

import { friendlyMetaSyncError, isMetaSyncConnectionError } from '@/features/dashboard/inbox/lib/metaInboxSyncErrors';

describe('friendlyMetaSyncError', () => {

  it('friendlyMetaSyncError is exported', () => {
    expect(typeof friendlyMetaSyncError).toBe('function');
  });

});

describe('isMetaSyncConnectionError', () => {

  it('isMetaSyncConnectionError is exported', () => {
    expect(typeof isMetaSyncConnectionError).toBe('function');
  });

});
