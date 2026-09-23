import { describe, expect, it } from 'vitest';

import * as mod from '@/features/guest/form/lib/fetchGuestBookedDates';

describe('fetchGuestBookedDates', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
