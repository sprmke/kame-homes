import { describe, expect, it } from 'vitest';

import { developmentDetailPath } from '@/features/guest/marketing/developments/lib/resolvePublicDevelopment';

describe('developmentDetailPath', () => {
  it('builds an encoded development detail path', () => {
    expect(developmentDetailPath('azure-north')).toBe('/developments/azure-north');
    expect(developmentDetailPath('a b')).toBe('/developments/a%20b');
  });
});
