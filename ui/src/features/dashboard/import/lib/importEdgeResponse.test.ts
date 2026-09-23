import { describe, expect, it } from 'vitest';

import { importEdgeErrorMessage } from '@/features/dashboard/import/lib/importEdgeResponse';

describe('importEdgeErrorMessage', () => {

  it('importEdgeErrorMessage is exported', () => {
    expect(typeof importEdgeErrorMessage).toBe('function');
  });

});
