import { describe, expect, it } from 'vitest';

import {
  guestTripChecklist,
  guestTripHeadline,
  guestTripListGroup,
  guestTripNextAction,
  guestTripPhase,
  guestTripProgress,
  guestTripTiming,
  isGuestTripPostStay,
  isGuestTripTimeRule,
  type GuestTripHeadlineInput,
  type GuestTripPhase,
} from '@/features/guest/trip/lib/guestTripPhase';

const HEADLINE_BASE: Omit<GuestTripHeadlineInput, 'phase' | 'timing'> = {
  checkInTimeLabel: '2:00 PM',
  checkOutTimeLabel: '11:00 AM',
  checkInDateLabel: 'Sat, Oct 10',
  checkOutDateLabel: 'Mon, Oct 12',
  documentsPending: false,
  sdFormAvailable: false,
  refundLabel: null,
};

const ACTION_BASE = {
  amountDue: 0,
  sdFormAvailable: false,
  reviewAvailable: false,
  reviewSubmitted: false,
  stayGuideAvailable: false,
  directionsAvailable: false,
  parkingFindAvailable: false,
};

describe('guestTripTiming', () => {
  it('counts days until check-in, nights in the stay, and check-out day', () => {
    expect(guestTripTiming('2026-10-10', '2026-10-12', '2026-10-04')).toEqual({
      kind: 'upcoming',
      daysUntil: 6,
    });
    expect(guestTripTiming('2026-10-10', '2026-10-13', '2026-10-11')).toEqual({
      kind: 'in_stay',
      night: 2,
      nights: 3,
    });
    expect(guestTripTiming('2026-10-30', '2026-11-02', '2026-11-02')).toEqual({
      kind: 'checkout_day',
    });
    expect(guestTripTiming('2026-10-30', '2026-11-02', '2026-11-03')).toEqual({ kind: 'past' });
  });
});

describe('guestTripPhase', () => {
  it('maps statuses and Manila timing onto one phase', () => {
    const upcoming = { kind: 'upcoming', daysUntil: 3 } as const;
    expect(guestTripPhase('PENDING_REVIEW', upcoming)).toBe('requested');
    expect(guestTripPhase('PENDING_DOCUMENTS', upcoming)).toBe('confirmed');
    expect(guestTripPhase('PENDING_GAF', upcoming)).toBe('confirmed');
    expect(guestTripPhase('READY_FOR_CHECKIN', upcoming)).toBe('arriving');
    expect(guestTripPhase('READY_FOR_CHECKIN', { kind: 'upcoming', daysUntil: 0 })).toBe(
      'arrival_day'
    );
    expect(guestTripPhase('READY_FOR_CHECKIN', { kind: 'in_stay', night: 1, nights: 3 })).toBe(
      'arrival_day'
    );
    expect(guestTripPhase('READY_FOR_CHECKIN', { kind: 'in_stay', night: 2, nights: 3 })).toBe(
      'staying'
    );
    expect(guestTripPhase('READY_FOR_CHECKIN', { kind: 'checkout_day' })).toBe('checkout_day');
    expect(guestTripPhase('READY_FOR_CHECKIN', { kind: 'past' })).toBe('checked_out');
    expect(guestTripPhase('READY_FOR_CHECKOUT', { kind: 'past' })).toBe('checked_out');
    expect(guestTripPhase('PENDING_SD_REFUND', { kind: 'past' })).toBe('refund_pending');
    expect(guestTripPhase('COMPLETED', { kind: 'past' })).toBe('completed');
    expect(guestTripPhase('CANCELLED', upcoming)).toBe('cancelled');
  });
});

describe('guestTripProgress', () => {
  it('keeps the bar in step with the phase, so pill and progress never disagree', () => {
    const cases: [GuestTripPhase, { done: number; active: number }][] = [
      ['requested', { done: 0, active: 0 }],
      ['confirmed', { done: 1, active: 1 }],
      ['arrival_day', { done: 2, active: 2 }],
      ['checkout_day', { done: 3, active: 3 }],
      ['refund_pending', { done: 4, active: 4 }],
      ['completed', { done: 5, active: -1 }],
      ['cancelled', { done: 0, active: -1 }],
    ];
    for (const [phase, expected] of cases) expect(guestTripProgress(phase)).toEqual(expected);
  });
});

describe('guestTripHeadline', () => {
  it('says what the host is doing while documents are pending', () => {
    const headline = guestTripHeadline({
      ...HEADLINE_BASE,
      phase: 'confirmed',
      timing: { kind: 'upcoming', daysUntil: 6 },
      documentsPending: true,
    });
    expect(headline.title).toBe('Your host is preparing your check-in documents');
    expect(headline.body).toBe('Check-in Sat, Oct 10 from 2:00 PM');
  });

  it('names the deadline on arrival and check-out days', () => {
    expect(
      guestTripHeadline({
        ...HEADLINE_BASE,
        phase: 'arrival_day',
        timing: { kind: 'upcoming', daysUntil: 0 },
      }).title
    ).toBe('Check in from 2:00 PM');
    expect(
      guestTripHeadline({
        ...HEADLINE_BASE,
        phase: 'checkout_day',
        timing: { kind: 'checkout_day' },
      }).title
    ).toBe('Check out by 11:00 AM');
  });

  it('closes the deposit story on completed stays', () => {
    const headline = guestTripHeadline({
      ...HEADLINE_BASE,
      phase: 'completed',
      timing: { kind: 'past' },
      refundLabel: '₱1,600',
    });
    expect(headline.body).toBe('Deposit refunded: ₱1,600');
  });

  it('asks for refund details only when the form is open', () => {
    const open = guestTripHeadline({
      ...HEADLINE_BASE,
      phase: 'checked_out',
      timing: { kind: 'past' },
      sdFormAvailable: true,
    });
    expect(open.title).toBe('Get your deposit back');
    const closed = guestTripHeadline({
      ...HEADLINE_BASE,
      phase: 'checked_out',
      timing: { kind: 'past' },
    });
    expect(closed.title).toBe('Thanks for staying');
  });
});

describe('guestTripNextAction', () => {
  it('puts an unpaid balance ahead of the stay guide', () => {
    expect(
      guestTripNextAction({
        ...ACTION_BASE,
        phase: 'checkout_day',
        amountDue: 2000,
        stayGuideAvailable: true,
      })
    ).toBe('pay');
  });

  it('puts the refund form first after check-out', () => {
    expect(
      guestTripNextAction({
        ...ACTION_BASE,
        phase: 'checked_out',
        sdFormAvailable: true,
        amountDue: 10,
      })
    ).toBe('sd_form');
  });

  it('sends pending and cancelled bookings to the host, not to editing', () => {
    expect(guestTripNextAction({ ...ACTION_BASE, phase: 'requested' })).toBe('message_host');
    expect(guestTripNextAction({ ...ACTION_BASE, phase: 'cancelled' })).toBe('message_host');
  });

  it('uses the stay guide or directions on arrival day', () => {
    expect(
      guestTripNextAction({ ...ACTION_BASE, phase: 'arrival_day', stayGuideAvailable: true })
    ).toBe('stay_guide');
    expect(
      guestTripNextAction({ ...ACTION_BASE, phase: 'arrival_day', directionsAvailable: true })
    ).toBe('directions');
  });

  it('offers a review, then booking again, once the stay is over', () => {
    expect(guestTripNextAction({ ...ACTION_BASE, phase: 'completed', reviewAvailable: true })).toBe(
      'review'
    );
    expect(
      guestTripNextAction({
        ...ACTION_BASE,
        phase: 'completed',
        reviewAvailable: true,
        reviewSubmitted: true,
      })
    ).toBe('book_again');
  });

  it('suggests parking before arrival when it is wanted but not reserved', () => {
    expect(
      guestTripNextAction({ ...ACTION_BASE, phase: 'arriving', parkingFindAvailable: true })
    ).toBe('find_parking');
  });
});

describe('guestTripChecklist', () => {
  const base = {
    ratesConfirmed: true,
    totalBalance: 7400,
    amountDueLabel: '₱2,000' as string | null,
    documents: [{ status: 'ready' as const }, { status: 'pending' as const }],
    parkingRequested: true,
    parkingReserved: false,
    parkingHref: '/parkings?linkStay=x',
  };

  it('lists payment, documents and parking while the stay is active', () => {
    const items = guestTripChecklist({ ...base, phase: 'arriving' });
    expect(items.map((item) => [item.key, item.done, item.label])).toEqual([
      ['payment', false, '₱2,000 left to pay'],
      ['documents', false, 'Check-in documents: 1 of 2 approved'],
      ['parking', false, 'Parking not reserved yet'],
    ]);
    expect(items[2]?.href).toBe('/parkings?linkStay=x');
  });

  it('marks paid balances done and hides the list outside the active stay', () => {
    const items = guestTripChecklist({ ...base, phase: 'confirmed', amountDueLabel: null });
    expect(items[0]).toMatchObject({ key: 'payment', done: true, label: 'Paid in full' });
    expect(guestTripChecklist({ ...base, phase: 'requested' })).toEqual([]);
    expect(guestTripChecklist({ ...base, phase: 'staying' }).map((item) => item.key)).toEqual([
      'payment',
      'parking',
    ]);
    expect(guestTripChecklist({ ...base, phase: 'completed' })).toEqual([]);
  });
});

describe('guestTripListGroup', () => {
  it('keeps checked-out trips awaiting refund in the upcoming group', () => {
    expect(
      guestTripListGroup({
        status: 'PENDING_SD_REFUND',
        checkOutYmd: '2026-09-01',
        todayYmd: '2026-10-04',
      })
    ).toBe('upcoming');
    expect(
      guestTripListGroup({ status: 'CANCELLED', checkOutYmd: '2026-11-01', todayYmd: '2026-10-04' })
    ).toBe('cancelled');
  });
});

describe('small helpers', () => {
  it('detects post-stay statuses', () => {
    expect(isGuestTripPostStay('READY_FOR_CHECKIN')).toBe(false);
    expect(isGuestTripPostStay('PENDING_SD_REFUND')).toBe(true);
  });

  it('spots listing rules that only restate check-in / check-out times', () => {
    expect(isGuestTripTimeRule('Check-in: After 2:00 PM')).toBe(true);
    expect(isGuestTripTimeRule('Checkout: Before 12:00 PM')).toBe(true);
    expect(isGuestTripTimeRule('Check-in time: 3 PM')).toBe(true);
    expect(isGuestTripTimeRule('Check out the rooftop pool')).toBe(false);
    expect(isGuestTripTimeRule('No smoking')).toBe(false);
  });
});
