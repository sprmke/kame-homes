import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  BOOKING_WORKFLOW_EMAIL_KINDS,
  isBookingWorkflowEmailKind,
  SendBookingWorkflowEmailError,
} from '../_shared/sendBookingWorkflowEmail.ts';

Deno.test('isBookingWorkflowEmailKind accepts all five kinds', () => {
  for (const kind of BOOKING_WORKFLOW_EMAIL_KINDS) {
    assertEquals(isBookingWorkflowEmailKind(kind), true);
  }
  assertEquals(isBookingWorkflowEmailKind('unknown'), false);
  assertEquals(isBookingWorkflowEmailKind(null), false);
});

Deno.test('SendBookingWorkflowEmailError carries HTTP status', () => {
  const err = new SendBookingWorkflowEmailError('GAF request PDF is missing', 400);
  assertEquals(err.status, 400);
  assertEquals(err.message, 'GAF request PDF is missing');
  assertThrows(() => {
    throw err;
  }, SendBookingWorkflowEmailError);
});
