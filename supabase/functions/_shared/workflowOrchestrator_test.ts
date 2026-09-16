import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import type { DocumentRequirement } from './documentRequirements.ts';
import { __workflowOrchestratorTesting } from './workflowOrchestrator.ts';

const {
  computeBalance,
  flag,
  resolveDocTarget,
  resolveLegacyCompletionId,
  assertParkingPaymentReceiptIfRequired,
} = __workflowOrchestratorTesting;

Deno.test('computeBalance — booking rate minus down payment', () => {
  assertEquals(computeBalance(10000, 3000), 7000);
  assertEquals(computeBalance(null, 3000), null);
  assertEquals(computeBalance(10000, null), null);
});

Deno.test('flag — defaults true when dev control omitted', () => {
  assertEquals(flag({}, 'generatePdf'), true);
  assertEquals(flag({ generatePdf: false }, 'generatePdf'), false);
});

Deno.test('resolveDocTarget — maps legacy PENDING_GAF to gaf requirement id', () => {
  const requirements: DocumentRequirement[] = [
    {
      id: 'gaf',
      label: 'GAF',
      order: 1,
      pdfTemplateId: 'gaf',
      approvalSource: 'email-listener',
      triggerCondition: 'always',
      calendarIcon: null,
    },
  ];
  const resolved = resolveDocTarget('PENDING_GAF', requirements);
  assert(resolved);
  assertEquals(resolved.requirementId, 'gaf');
  assertEquals(resolved.configured, true);
});

Deno.test('resolveLegacyCompletionId — falls back when requirement renamed', () => {
  const requirements: DocumentRequirement[] = [
    {
      id: 'custom-gaf',
      label: 'GAF',
      order: 1,
      pdfTemplateId: 'gaf',
      approvalSource: 'email-listener',
      triggerCondition: 'always',
      calendarIcon: null,
    },
  ];
  assertEquals(resolveLegacyCompletionId('PENDING_GAF', requirements), 'custom-gaf');
});

Deno.test('assertParkingPaymentReceiptIfRequired — throws when receipt missing', () => {
  assertThrows(
    () =>
      assertParkingPaymentReceiptIfRequired(
        { parking_fee_included_in_downpayment: false, parking_payment_receipt_url: '' },
        {}
      ),
    Error,
    'Upload a parking payment receipt'
  );
});

Deno.test('assertParkingPaymentReceiptIfRequired — no-op when fee included', () => {
  assertParkingPaymentReceiptIfRequired(
    { parking_fee_included_in_downpayment: true, parking_payment_receipt_url: '' },
    {}
  );
});
