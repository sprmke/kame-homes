import { describe, expect, it } from 'vitest';

import { marketingContentFingerprint } from '@/features/dashboard/marketing/lib/marketingContentFingerprint';

describe('marketingContentFingerprint', () => {

  it('marketingContentFingerprint is exported', () => {
    expect(typeof marketingContentFingerprint).toBe('function');
  });

});
