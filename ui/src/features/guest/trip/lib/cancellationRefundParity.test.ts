import { describe, expect, it } from 'vitest';

import * as clientPolicy from '@/features/dashboard/org/lib/cancellationPolicy';
import * as client from '@/features/guest/trip/lib/cancellationRefund';
import type { CancellationMoneyInput } from '@/features/guest/trip/lib/cancellationRefund';
import * as serverPolicy from '../../../../../../supabase/functions/_shared/cancellationPolicy';
import * as server from '../../../../../../supabase/functions/_shared/cancellationRefund';

const BASE_BOOKING = {
  bookingRate: 10000,
  downPayment: 8000,
  guestBalancePaid: 0,
  securityDeposit: 1500,
  petFee: 500,
  hasPets: true,
  additionalFee: 0,
  voucherDiscount: 0,
  bookingSource: 'Direct',
  externalSource: null,
  checkInDate: '2026-12-20',
};

const CASES: Array<{
  policy: 'flexible' | 'moderate' | 'firm' | 'non_refundable' | null;
  cancelledAt: string;
  initiator: 'guest' | 'host';
  overrideRefundPhp?: number | null;
  booking?: Partial<CancellationMoneyInput>;
}> = [
  { policy: 'moderate', cancelledAt: '2026-11-20T12:00:00.000Z', initiator: 'guest' },
  { policy: 'moderate', cancelledAt: '2026-12-10T06:00:00.000Z', initiator: 'guest' },
  { policy: 'moderate', cancelledAt: '2026-12-16T06:00:00.000Z', initiator: 'guest' },
  { policy: 'firm', cancelledAt: '2026-12-10T06:00:00.000Z', initiator: 'guest' },
  { policy: 'firm', cancelledAt: '2026-12-10T06:00:00.000Z', initiator: 'guest', overrideRefundPhp: 1000 },
  { policy: 'firm', cancelledAt: '2026-12-10T06:00:00.000Z', initiator: 'guest', overrideRefundPhp: 9000 },
  { policy: 'non_refundable', cancelledAt: '2026-12-16T06:00:00.000Z', initiator: 'host' },
  { policy: 'moderate', cancelledAt: '2026-12-20T07:00:00.000Z', initiator: 'guest' },
  { policy: null, cancelledAt: '2026-12-10T06:00:00.000Z', initiator: 'guest' },
  {
    policy: 'moderate',
    cancelledAt: '2026-12-10T06:00:00.000Z',
    initiator: 'guest',
    booking: { externalSource: 'Airbnb' },
  },
  {
    policy: 'moderate',
    cancelledAt: '2026-12-10T06:00:00.000Z',
    initiator: 'guest',
    booking: { downPayment: 0 },
  },
];

describe('cancellation refund client/server parity', () => {
  it('returns the same outcome for every fixture', () => {
    for (const fixture of CASES) {
      const clientOutcome = client.computeCancellationOutcome({
        policy: fixture.policy ? clientPolicy.buildCancellationPreset(fixture.policy) : null,
        booking: { ...BASE_BOOKING, ...fixture.booking },
        cancelledAt: fixture.cancelledAt,
        checkInTime: '14:00',
        initiator: fixture.initiator,
        overrideRefundPhp: fixture.overrideRefundPhp ?? null,
      });
      const serverOutcome = server.computeCancellationOutcome({
        policy: fixture.policy ? serverPolicy.buildCancellationPreset(fixture.policy) : null,
        booking: { ...BASE_BOOKING, ...fixture.booking },
        cancelledAt: fixture.cancelledAt,
        checkInTime: '14:00',
        initiator: fixture.initiator,
        overrideRefundPhp: fixture.overrideRefundPhp ?? null,
      });
      expect(clientOutcome).toEqual(serverOutcome);
    }
  });
});
