import { describe, expect, it } from 'vitest';

import { normalizeBlockLevelPlaceholdersInHtml } from '@/features/dashboard/bookings/lib/normalizeBlockLevelPlaceholders';

describe('normalizeBlockLevelPlaceholdersInHtml', () => {

  it('normalizeBlockLevelPlaceholdersInHtml is exported', () => {
    expect(typeof normalizeBlockLevelPlaceholdersInHtml).toBe('function');
  });

});
