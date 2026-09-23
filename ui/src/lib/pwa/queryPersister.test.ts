import { describe, expect, it } from 'vitest';

import { createQueryPersister } from '@/lib/pwa/queryPersister';

describe('createQueryPersister', () => {

  it('createQueryPersister is exported', () => {
    expect(typeof createQueryPersister).toBe('function');
  });

});
