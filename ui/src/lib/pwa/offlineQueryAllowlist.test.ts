import { describe, expect, it } from 'vitest';

import { queryKeyRoot, shouldPersistQuery } from '@/lib/pwa/offlineQueryAllowlist';

describe('queryKeyRoot', () => {

  it('queryKeyRoot is exported', () => {
    expect(typeof queryKeyRoot).toBe('function');
  });

});

describe('shouldPersistQuery', () => {

  it('shouldPersistQuery is exported', () => {
    expect(typeof shouldPersistQuery).toBe('function');
  });

});
