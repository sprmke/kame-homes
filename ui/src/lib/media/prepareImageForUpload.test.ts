import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/media/prepareImageForUpload';

describe('prepareImageForUpload', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
