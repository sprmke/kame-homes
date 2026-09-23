import { describe, expect, it } from 'vitest';

import { shouldWarnPastBookingStayForProceed } from '@/features/dashboard/bookings/lib/bookingPastPipelineManila';

describe('shouldWarnPastBookingStayForProceed', () => {

  it('shouldWarnPastBookingStayForProceed is exported', () => {
    expect(typeof shouldWarnPastBookingStayForProceed).toBe('function');
  });

});
