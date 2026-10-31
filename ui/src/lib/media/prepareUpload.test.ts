import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/media/prepareUpload';

describe('prepareUpload', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
