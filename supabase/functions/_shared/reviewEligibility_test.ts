import { assertEquals } from 'jsr:@std/assert@1';

import {
  bookingReachedCheckout,
  canClaimStayVoucher,
  checkoutTransitionOpensReviewWindow,
  guestCanReview,
  hostCanReview,
} from './reviewEligibility.ts';

const PAST_CHECKOUT = '2020-01-01';
const FUTURE_CHECKOUT = '2099-01-01';

Deno.test('bookingReachedCheckout: true for every post-checkout status regardless of date', () => {
  for (const status of ['READY_FOR_CHECKOUT', 'PENDING_SD_REFUND', 'COMPLETED']) {
    assertEquals(bookingReachedCheckout({ status, check_out_date: FUTURE_CHECKOUT }), true);
  }
});

Deno.test('guestCanReview + hostCanReview: open while the SD refund is pending', () => {
  const row = { status: 'PENDING_SD_REFUND', check_out_date: PAST_CHECKOUT };
  const openWindow = { closes_at: '2099-01-01T00:00:00.000Z', published_at: null };
  assertEquals(guestCanReview(row, openWindow), true);
  assertEquals(hostCanReview(row, openWindow), true);
});

Deno.test(
  'bookingReachedCheckout: READY_FOR_CHECKIN only counts once check-out date has passed',
  () => {
    assertEquals(
      bookingReachedCheckout({ status: 'READY_FOR_CHECKIN', check_out_date: PAST_CHECKOUT }),
      true
    );
    assertEquals(
      bookingReachedCheckout({ status: 'READY_FOR_CHECKIN', check_out_date: FUTURE_CHECKOUT }),
      false
    );
  }
);

Deno.test('bookingReachedCheckout: false for earlier statuses and CANCELLED', () => {
  assertEquals(
    bookingReachedCheckout({ status: 'PENDING_REVIEW', check_out_date: PAST_CHECKOUT }),
    false
  );
  assertEquals(
    bookingReachedCheckout({ status: 'PENDING_DOCUMENTS', check_out_date: PAST_CHECKOUT }),
    false
  );
  assertEquals(
    bookingReachedCheckout({ status: 'CANCELLED', check_out_date: PAST_CHECKOUT }),
    false
  );
});

Deno.test('guestCanReview: false before check-out', () => {
  const row = { status: 'READY_FOR_CHECKIN', check_out_date: FUTURE_CHECKOUT };
  assertEquals(guestCanReview(row, null), false);
});

Deno.test('guestCanReview: true after check-out when no window exists yet', () => {
  const row = { status: 'COMPLETED', check_out_date: PAST_CHECKOUT };
  assertEquals(guestCanReview(row, null), true);
});

Deno.test('guestCanReview: respects an open window and a closed/published one', () => {
  const row = { status: 'COMPLETED', check_out_date: PAST_CHECKOUT };
  const openWindow = { closes_at: '2099-01-01T00:00:00.000Z', published_at: null };
  const publishedWindow = {
    closes_at: '2020-01-15T00:00:00.000Z',
    published_at: '2020-01-10T00:00:00.000Z',
  };
  assertEquals(guestCanReview(row, openWindow), true);
  assertEquals(guestCanReview(row, publishedWindow), false);
});

Deno.test(
  'hostCanReview matches guestCanReview — same gate, source-agnostic (Airbnb included)',
  () => {
    const airbnbRow = {
      status: 'COMPLETED',
      check_out_date: PAST_CHECKOUT,
      booking_source: 'Airbnb',
    };
    const openWindow = { closes_at: '2099-01-01T00:00:00.000Z', published_at: null };
    assertEquals(hostCanReview(airbnbRow, openWindow), true);
    assertEquals(hostCanReview(airbnbRow, null), true);
  }
);

Deno.test(
  'canClaimStayVoucher (D3): decoupled from review state — only checks check-out reached',
  () => {
    assertEquals(canClaimStayVoucher({ status: 'COMPLETED', check_out_date: PAST_CHECKOUT }), true);
    assertEquals(
      canClaimStayVoucher({ status: 'READY_FOR_CHECKIN', check_out_date: FUTURE_CHECKOUT }),
      false
    );
  }
);

Deno.test('checkoutTransitionOpensReviewWindow: only RFCI → RFCO', () => {
  assertEquals(
    checkoutTransitionOpensReviewWindow('READY_FOR_CHECKIN', 'READY_FOR_CHECKOUT'),
    true
  );
  assertEquals(
    checkoutTransitionOpensReviewWindow('READY_FOR_CHECKOUT', 'PENDING_SD_REFUND'),
    false
  );
  assertEquals(checkoutTransitionOpensReviewWindow('PENDING_REVIEW', 'READY_FOR_CHECKIN'), false);
});
