/**
 * Property lifecycle rules — state mapping, activation gates, automation matrix.
 * Run: deno test --allow-env supabase/functions/_shared/propertyLifecycle_test.ts
 */

import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { emptyContractLegLifecycle } from './contractLifecycle.ts';
import { emptyListingAuthorizationState } from './listingAuthorization.ts';
import { canHostActivate, evaluateHostActivation, guestDateToYmd } from './propertyLifecycle.ts';
import {
  automationAllowed,
  inactiveReasonLabel,
  resolvePropertyLifecycleState,
  stateAcceptsNewBookings,
  type PropertyAutomationJob,
} from './propertyLifecycleState.ts';

const approvedAuthorization = {
  ...emptyListingAuthorizationState(),
  baseStatus: 'approved' as const,
  assets: {
    proofPath: 'proof.pdf',
    additionalProofPath: null,
    azurePmoConfirmationPath: null,
  },
};

Deno.test('state mapping covers every inactive reason', () => {
  assertEquals(resolvePropertyLifecycleState({ status: 'ACTIVE', inactive_reason: null }), 'live');
  assertEquals(
    resolvePropertyLifecycleState({ status: 'INACTIVE', inactive_reason: 'paused' }),
    'paused'
  );
  assertEquals(
    resolvePropertyLifecycleState({ status: 'INACTIVE', inactive_reason: 'pending_verification' }),
    'pending_verification'
  );
  for (const reason of ['contract_lapsed', 'consideration_denied', 'succession']) {
    assertEquals(
      resolvePropertyLifecycleState({ status: 'INACTIVE', inactive_reason: reason }),
      'suspended'
    );
  }
  assertEquals(
    resolvePropertyLifecycleState({ status: 'INACTIVE', inactive_reason: 'archived' }),
    'archived'
  );
});

Deno.test('an ACTIVE row wins over a stale reason', () => {
  assertEquals(
    resolvePropertyLifecycleState({ status: 'ACTIVE', inactive_reason: 'archived' }),
    'live'
  );
});

Deno.test('unknown inactive reason falls back to the safest closed state', () => {
  assertEquals(
    resolvePropertyLifecycleState({ status: 'INACTIVE', inactive_reason: null }),
    'archived'
  );
  assertEquals(
    resolvePropertyLifecycleState({ status: 'INACTIVE', inactive_reason: 'mystery' }),
    'archived'
  );
});

Deno.test('reason labels are host-facing', () => {
  assertEquals(inactiveReasonLabel('paused'), 'Paused');
  assertEquals(inactiveReasonLabel('consideration_denied'), 'Contract extension declined');
  assertEquals(inactiveReasonLabel(null), null);
});

Deno.test('only live listings accept new bookings', () => {
  assert(stateAcceptsNewBookings('live'));
  assertFalse(stateAcceptsNewBookings('paused'));
  assertFalse(stateAcceptsNewBookings('pending_verification'));
  assertFalse(stateAcceptsNewBookings('suspended'));
  assertFalse(stateAcceptsNewBookings('archived'));
});

Deno.test('host activation needs an approved listing and a current contract', () => {
  const block = evaluateHostActivation({
    state: 'archived',
    inactiveReason: 'archived',
    authorization: emptyListingAuthorizationState(),
    hasActiveUnitPeer: false,
  });
  assertEquals(block?.code, 'listing_not_approved');
  assertFalse(
    canHostActivate({
      state: 'archived',
      inactiveReason: 'archived',
      authorization: emptyListingAuthorizationState(),
      hasActiveUnitPeer: false,
    })
  );

  const locked = evaluateHostActivation({
    state: 'suspended',
    inactiveReason: 'contract_lapsed',
    authorization: {
      ...approvedAuthorization,
      lifecycle: { ...emptyContractLegLifecycle(), accessLockedAt: '2026-01-01T00:00:00.000Z' },
    },
    hasActiveUnitPeer: false,
  });
  assertEquals(locked?.code, 'contract_locked');
});

Deno.test('a paused host decision outlives a contract renewal', () => {
  const block = evaluateHostActivation({
    state: 'paused',
    inactiveReason: 'paused',
    authorization: approvedAuthorization,
    hasActiveUnitPeer: false,
  });
  assertEquals(block, null, 'pause is a host decision, not a verification block');
});

Deno.test('succession blocks restore only while a peer still holds the unit', () => {
  const stillHeld = evaluateHostActivation({
    state: 'suspended',
    inactiveReason: 'succession',
    authorization: approvedAuthorization,
    hasActiveUnitPeer: true,
  });
  assertEquals(stillHeld?.code, 'succession');

  const peerGone = evaluateHostActivation({
    state: 'suspended',
    inactiveReason: 'succession',
    authorization: approvedAuthorization,
    hasActiveUnitPeer: false,
  });
  assertEquals(peerGone, null);
});

Deno.test('a denied extension cannot be restored without a new contract', () => {
  const block = evaluateHostActivation({
    state: 'suspended',
    inactiveReason: 'consideration_denied',
    authorization: approvedAuthorization,
    hasActiveUnitPeer: false,
  });
  assertEquals(block?.code, 'consideration_denied');
});

Deno.test('pending verification cannot be put live by the host', () => {
  const block = evaluateHostActivation({
    state: 'pending_verification',
    inactiveReason: 'pending_verification',
    authorization: approvedAuthorization,
    hasActiveUnitPeer: false,
  });
  assertEquals(block?.code, 'pending_verification');
});

Deno.test('automation matrix: paused keeps every job, archived stops operational jobs', () => {
  const jobs: PropertyAutomationJob[] = [
    'booking_email',
    'sd_refund',
    'cancellation_refund',
    'review_lifecycle',
    'ical_import',
    'ical_export',
    'smart_pricing',
    'meta_scheduled_post',
    'telegram_digest',
    'inbox_ai_auto_reply',
    'voice_receptionist',
  ];

  for (const job of jobs) {
    assert(automationAllowed('live', job), `live should allow ${job}`);
    assert(automationAllowed('paused', job), `paused should allow ${job}`);
  }

  for (const job of jobs) {
    const allowed = automationAllowed('archived', job);
    const expected = ['booking_email', 'sd_refund', 'cancellation_refund', 'review_lifecycle'];
    assertEquals(allowed, expected.includes(job), `archived / ${job}`);
  }

  for (const job of jobs) {
    const allowed = automationAllowed('suspended', job);
    const expected = ['booking_email', 'sd_refund', 'cancellation_refund', 'review_lifecycle'];
    assertEquals(allowed, expected.includes(job), `suspended / ${job}`);
  }
});

Deno.test('guest dates normalize from both stored formats', () => {
  assertEquals(guestDateToYmd('12-25-2026'), '2026-12-25');
  assertEquals(guestDateToYmd('2026-12-25'), '2026-12-25');
  assertEquals(guestDateToYmd('1-5-2026'), '2026-01-05');
  assertEquals(guestDateToYmd(''), null);
  assertEquals(guestDateToYmd(null), null);
  assertEquals(guestDateToYmd('not a date'), null);
});
