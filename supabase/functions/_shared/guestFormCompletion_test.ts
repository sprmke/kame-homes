/**
 * Unit tests for the pure guards in guestFormCompletion.ts.
 * Run: deno test --allow-net --allow-env --no-check \
 *   --env-file=supabase/.temp/functions-serve.env \
 *   supabase/functions/_shared/guestFormCompletion_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { addDaysYmd, manilaTodayYmd } from './calendarAvailabilityManila.ts';
import {
  checkCompletionEligibility,
  guestFormCompletionPath,
  isCompletionLinkLive,
} from './guestFormCompletion.ts';
import type { GuestSubmission } from './types.ts';

/** Offsets from Manila "today" (matches `isCompletionLinkLive` / `manilaTodayYmd`). */
function futureManila(days: number): string {
  return addDaysYmd(manilaTodayYmd(), days);
}

const base = (over: Partial<GuestSubmission>): GuestSubmission =>
  ({
    id: 'b1',
    property_id: 'p1',
    status: 'PENDING_REVIEW',
    booking_source: 'Airbnb',
    external_source: 'airbnb',
    check_out_date: futureManila(10),
    ...over,
  }) as GuestSubmission;

Deno.test('guestFormCompletionPath — includes token + property slug', () => {
  assertEquals(
    guestFormCompletionPath('https://kame.test/', 'tok123', 'my-unit'),
    'https://kame.test/form?complete=tok123&property=my-unit'
  );
  // no slug → just the token
  assertEquals(
    guestFormCompletionPath('https://kame.test', 'tok123', ''),
    'https://kame.test/form?complete=tok123'
  );
});

Deno.test('isCompletionLinkLive — future checkout ok; past / cancelled not', () => {
  assert(isCompletionLinkLive({ status: 'PENDING_REVIEW', check_out_date: futureManila(1) }));
  assert(
    isCompletionLinkLive({ status: 'PENDING_REVIEW', check_out_date: futureManila(0) }),
    'today ok'
  );
  assert(
    !isCompletionLinkLive({ status: 'PENDING_REVIEW', check_out_date: futureManila(-1) }),
    'past'
  );
  assert(
    !isCompletionLinkLive({ status: 'CANCELLED', check_out_date: futureManila(5) }),
    'cancelled'
  );
  assert(!isCompletionLinkLive({ status: 'PENDING_REVIEW', check_out_date: '' }), 'no date');
});

Deno.test('checkCompletionEligibility — happy path', () => {
  assertEquals(checkCompletionEligibility(base({})), { ok: true });
});

Deno.test(
  'checkCompletionEligibility — booking_source Airbnb without external_source still ok (legacy rows)',
  () => {
    assertEquals(
      checkCompletionEligibility(base({ external_source: null, booking_source: 'Airbnb' })),
      { ok: true }
    );
  }
);

Deno.test('checkCompletionEligibility — non-OTA booking rejected', () => {
  assertEquals(
    checkCompletionEligibility(base({ external_source: null, booking_source: 'Facebook' })),
    { ok: false, reason: 'not_external' }
  );
});

Deno.test(
  'checkCompletionEligibility — already advanced past review rejected (wrong_status)',
  () => {
    for (const status of ['PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', 'COMPLETED']) {
      assertEquals(
        checkCompletionEligibility(base({ status })),
        { ok: false, reason: 'wrong_status' },
        status
      );
    }
    // CANCELLED is caught by the stay-live check first → 410, not 409.
    assertEquals(checkCompletionEligibility(base({ status: 'CANCELLED' })), {
      ok: false,
      reason: 'link_expired',
    });
  }
);

Deno.test('checkCompletionEligibility — stay already over rejected', () => {
  assertEquals(checkCompletionEligibility(base({ check_out_date: futureManila(-2) })), {
    ok: false,
    reason: 'link_expired',
  });
});
