/**
 * dashboardAssistantRiskClassifier — pure-logic coverage (no Supabase / network).
 * Run: deno test --no-check --allow-env --allow-net supabase/functions/_shared/dashboardAssistantRiskClassifier_test.ts
 *
 * This is the actual write-safety gate for the AI dashboard assistant: every Tier-0/1/2 decision
 * for every tool call runs through classifyActionRisk, both at proposal time and again immediately
 * before execution (dashboardAssistantSafetyGuard.ts#assertActionSafeToExecute). It's fully
 * deterministic and DB-free, so this file is what closes the "owner with a foreign propertyId →
 * tier2 (never silently auto-executed)" and "guard re-derivation blocks a stale/mismatched tier"
 * cases from docs/workflow/for-testing/ai-llm-best-practices-hardening.md's Verification list —
 * the two items in that list that don't require a live DB round-trip.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  classifyActionRisk,
  isTierSufficient,
  type ActionRiskInput,
} from './dashboardAssistantRiskClassifier.ts';

const PROPERTY_A = '00000000-0000-0000-0000-0000000000a1';
const PROPERTY_B = '00000000-0000-0000-0000-0000000000b2';
const BOOKING_A = '00000000-0000-0000-0000-0000000000c3';
const BOOKING_B = '00000000-0000-0000-0000-0000000000d4';

// ─── isTierSufficient ────────────────────────────────────────────────────────

Deno.test('isTierSufficient — equal tiers are sufficient', () => {
  assertEquals(isTierSufficient('tier1_auto', 'tier1_auto'), true);
});

Deno.test('isTierSufficient — a higher executing tier covers a lower requirement', () => {
  assertEquals(isTierSufficient('tier2_confirmed', 'tier1_auto'), true);
  assertEquals(isTierSufficient('tier2_confirmed', 'tier0_read'), true);
});

Deno.test('isTierSufficient — a lower executing tier never covers a higher requirement', () => {
  assertEquals(isTierSufficient('tier1_auto', 'tier2_confirmed'), false);
  assertEquals(isTierSufficient('tier0_read', 'tier1_auto'), false);
  assertEquals(isTierSufficient('tier0_read', 'tier2_confirmed'), false);
});

// ─── classifyActionRisk — read / tier1 / tier2-only catalogs ────────────────

Deno.test(
  'classifyActionRisk — a cataloged read tool is always tier0, regardless of payload',
  () => {
    const tier = classifyActionRisk({ toolName: 'get_booking', targetBookingId: BOOKING_A });
    assertEquals(tier, 'tier0_read');
  }
);

Deno.test('classifyActionRisk — a TIER2_ONLY tool is tier2 even with an in-scope target', () => {
  const tier = classifyActionRisk({
    toolName: 'propose_cancel_booking',
    targetBookingId: BOOKING_A,
    pageContext: { bookingId: BOOKING_A },
  });
  assertEquals(tier, 'tier2_confirmed');
});

Deno.test('classifyActionRisk — a TIER1_ONLY tool is tier1 when in scope and not bulk', () => {
  const tier = classifyActionRisk({
    toolName: 'propose_mark_inbox_thread_read',
    targetBookingId: BOOKING_A,
    pageContext: { bookingId: BOOKING_A },
  });
  assertEquals(tier, 'tier1_auto');
});

// ─── classifyActionRisk — cross-scope escalation (the P0 "foreign propertyId" fix) ──

Deno.test(
  'classifyActionRisk — targeting a propertyId outside the page/attached scope escalates to tier2',
  () => {
    const input: ActionRiskInput = {
      toolName: 'propose_mark_inbox_thread_read',
      targetPropertyId: PROPERTY_B,
      pageContext: { propertyId: PROPERTY_A },
    };
    assertEquals(classifyActionRisk(input), 'tier2_confirmed');
  }
);

Deno.test(
  'classifyActionRisk — targeting a bookingId outside the page/attached scope escalates to tier2',
  () => {
    const input: ActionRiskInput = {
      toolName: 'propose_mark_inbox_thread_read',
      targetBookingId: BOOKING_B,
      pageContext: { bookingId: BOOKING_A },
    };
    assertEquals(classifyActionRisk(input), 'tier2_confirmed');
  }
);

Deno.test(
  'classifyActionRisk — an attached-context pin extends scope without forcing tier2',
  () => {
    const input: ActionRiskInput = {
      toolName: 'propose_mark_inbox_thread_read',
      targetPropertyId: PROPERTY_B,
      pageContext: { propertyId: PROPERTY_A },
      attachedContext: [{ type: 'property', id: PROPERTY_B, label: 'Property B' }],
    };
    assertEquals(classifyActionRisk(input), 'tier1_auto');
  }
);

Deno.test(
  'classifyActionRisk — no page/attached scope at all is not treated as cross-scope',
  () => {
    // No scope recorded for the turn means there is nothing to compare the target against — the
    // classifier does not invent a mismatch, it only escalates when a *different* id is on record.
    const input: ActionRiskInput = {
      toolName: 'propose_mark_inbox_thread_read',
      targetPropertyId: PROPERTY_B,
    };
    assertEquals(classifyActionRisk(input), 'tier1_auto');
  }
);

// ─── classifyActionRisk — bulk / untrusted-content escalation ───────────────

Deno.test('classifyActionRisk — isBulk always forces tier2, even for a TIER1_ONLY tool', () => {
  const input: ActionRiskInput = {
    toolName: 'propose_mark_inbox_thread_read',
    targetBookingId: BOOKING_A,
    pageContext: { bookingId: BOOKING_A },
    isBulk: true,
  };
  assertEquals(classifyActionRisk(input), 'tier2_confirmed');
});

// ─── classifyActionRisk — propose_transition_booking (statusMachine-derived) ─

Deno.test(
  'classifyActionRisk — a plain forward transition with no financial fields is tier1',
  () => {
    const input: ActionRiskInput = {
      toolName: 'propose_transition_booking',
      fromStatus: 'PENDING_REVIEW',
      toStatus: 'PENDING_DOCUMENTS',
    };
    assertEquals(classifyActionRisk(input), 'tier1_auto');
  }
);

Deno.test('classifyActionRisk — transitioning to CANCELLED is always tier2', () => {
  const input: ActionRiskInput = {
    toolName: 'propose_transition_booking',
    fromStatus: 'PENDING_REVIEW',
    toStatus: 'CANCELLED',
  };
  assertEquals(classifyActionRisk(input), 'tier2_confirmed');
});

Deno.test(
  'classifyActionRisk — refund finalization (PENDING_SD_REFUND -> COMPLETED) is tier2',
  () => {
    const input: ActionRiskInput = {
      toolName: 'propose_transition_booking',
      fromStatus: 'PENDING_SD_REFUND',
      toStatus: 'COMPLETED',
    };
    assertEquals(classifyActionRisk(input), 'tier2_confirmed');
  }
);

Deno.test(
  'classifyActionRisk — a forward transition carrying a financial payload field is tier2',
  () => {
    const input: ActionRiskInput = {
      toolName: 'propose_transition_booking',
      fromStatus: 'PENDING_REVIEW',
      toStatus: 'PENDING_DOCUMENTS',
      payload: { booking_rate: 1000 },
    };
    assertEquals(classifyActionRisk(input), 'tier2_confirmed');
  }
);

Deno.test(
  'classifyActionRisk — a zero/false financial field still counts as present (not stripped as falsy)',
  () => {
    const input: ActionRiskInput = {
      toolName: 'propose_transition_booking',
      fromStatus: 'PENDING_REVIEW',
      toStatus: 'PENDING_DOCUMENTS',
      payload: { security_deposit: 0 },
    };
    assertEquals(classifyActionRisk(input), 'tier2_confirmed');
  }
);

Deno.test(
  'classifyActionRisk — a manual-override-only edge (not a primary graph edge) is tier2',
  () => {
    const input: ActionRiskInput = {
      toolName: 'propose_transition_booking',
      fromStatus: 'COMPLETED',
      toStatus: 'PENDING_REVIEW',
    };
    assertEquals(classifyActionRisk(input), 'tier2_confirmed');
  }
);

Deno.test(
  'classifyActionRisk — an unrecognized status string is tier2, never a thrown error',
  () => {
    const input: ActionRiskInput = {
      toolName: 'propose_transition_booking',
      fromStatus: 'NOT_A_REAL_STATUS',
      toStatus: 'PENDING_DOCUMENTS',
    };
    assertEquals(classifyActionRisk(input), 'tier2_confirmed');
  }
);

// ─── classifyActionRisk — safe fallback for uncatalogued tools ──────────────

Deno.test('classifyActionRisk — an uncatalogued tool name defaults to tier2 (fail closed)', () => {
  const input: ActionRiskInput = { toolName: 'propose_something_not_in_any_catalog' };
  assertEquals(classifyActionRisk(input), 'tier2_confirmed');
});
