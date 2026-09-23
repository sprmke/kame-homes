import { describe, expect, it } from 'vitest';

import { normalizeEmailCalloutPlaceholders } from '@/features/dashboard/bookings/lib/normalizeEmailCalloutPlaceholders';

describe('normalizeEmailCalloutPlaceholders', () => {

  it('normalizeEmailCalloutPlaceholders is exported', () => {
    expect(typeof normalizeEmailCalloutPlaceholders).toBe('function');
  });

});
