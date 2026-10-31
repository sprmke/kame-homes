import { describe, expect, it } from 'vitest';

import {
  guestCalendarPath,
  guestFormPath,
  guestPropertyPath,
  guestSuccessPath,
} from '@/features/guest/lib/guestPublicPaths';

describe('guestPublicPaths', () => {
  it('builds property-scoped paths', () => {
    expect(guestPropertyPath('solea-mactan')).toBe('/properties/solea-mactan');
    expect(guestCalendarPath('solea-mactan')).toBe('/properties/solea-mactan/calendar');
    expect(guestFormPath('solea-mactan')).toBe('/properties/solea-mactan/form');
    expect(guestSuccessPath('solea-mactan')).toBe('/properties/solea-mactan/success');
  });

  it('returns /properties when slug empty', () => {
    expect(guestPropertyPath('')).toBe('/properties');
  });
});
