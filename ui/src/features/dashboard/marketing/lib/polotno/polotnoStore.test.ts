import { describe, expect, it } from 'vitest';

import { createPolotnoStore, hasUnpersistedBlobSources } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

describe('createPolotnoStore', () => {

  it('createPolotnoStore is exported', () => {
    expect(typeof createPolotnoStore).toBe('function');
  });

});

describe('hasUnpersistedBlobSources', () => {

  it('hasUnpersistedBlobSources is exported', () => {
    expect(typeof hasUnpersistedBlobSources).toBe('function');
  });

});
