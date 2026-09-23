import { describe, expect, it } from 'vitest';

import { initSyncEngine } from '@/lib/pwa/syncEngine';

describe('initSyncEngine', () => {

  it('initSyncEngine is exported', () => {
    expect(typeof initSyncEngine).toBe('function');
  });

});
