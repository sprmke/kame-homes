/**
 * Deno tests for booking statusMachine — booking-workflow.mdc §6 invariants.
 * Run: bun run test:edge
 */

import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  availableTransitions,
  bookingPipeline,
  canGuestPublicUpdateForm,
  canTransition,
  nextStep,
  pendingDocumentsClearPatchForGuestEditRevert,
  requestPdfClearPatchForChangedFormFields,
  shouldRevertGuestFieldEditsToPendingReview,
  TERMINAL_STATUSES,
} from './statusMachine.ts';

Deno.test('canTransition — happy path forward edges', () => {
  assert(canTransition('PENDING_REVIEW', 'PENDING_DOCUMENTS', { manual: false }));
  assert(canTransition('PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', { manual: false }));
  assert(canTransition('READY_FOR_CHECKIN', 'READY_FOR_CHECKOUT', { manual: false }));
  assert(canTransition('READY_FOR_CHECKOUT', 'COMPLETED', { manual: false }));
});

Deno.test('canTransition — D2 skip PENDING_REVIEW → READY_FOR_CHECKIN', () => {
  assert(canTransition('PENDING_REVIEW', 'READY_FOR_CHECKIN', { manual: false }));
});

Deno.test('canTransition — cancel from any non-terminal stage', () => {
  assert(canTransition('PENDING_REVIEW', 'CANCELLED', { manual: false }));
  assert(canTransition('READY_FOR_CHECKIN', 'CANCELLED', { manual: false }));
});

Deno.test('canTransition — terminal statuses have no outbound edges', () => {
  assertEquals(availableTransitions('COMPLETED', { manual: true }), []);
  assertEquals(availableTransitions('CANCELLED', { manual: true }), []);
  assert(TERMINAL_STATUSES.has('COMPLETED'));
  assert(TERMINAL_STATUSES.has('CANCELLED'));
});

Deno.test('canTransition — manual backward override only when manual', () => {
  assertFalse(canTransition('PENDING_DOCUMENTS', 'PENDING_REVIEW', { manual: false }));
  assert(canTransition('PENDING_DOCUMENTS', 'PENDING_REVIEW', { manual: true }));
  assert(canTransition('READY_FOR_CHECKOUT', 'READY_FOR_CHECKIN', { manual: true }));
});

Deno.test('canTransition — manual forward force READY_FOR_CHECKIN → PENDING_SD_REFUND', () => {
  assertFalse(canTransition('READY_FOR_CHECKIN', 'PENDING_SD_REFUND', { manual: false }));
  assert(canTransition('READY_FOR_CHECKIN', 'PENDING_SD_REFUND', { manual: true }));
});

Deno.test('shouldRevertGuestFieldEditsToPendingReview', () => {
  assert(shouldRevertGuestFieldEditsToPendingReview('PENDING_DOCUMENTS'));
  assert(shouldRevertGuestFieldEditsToPendingReview('READY_FOR_CHECKIN'));
  assertFalse(shouldRevertGuestFieldEditsToPendingReview('PENDING_REVIEW'));
  assertFalse(shouldRevertGuestFieldEditsToPendingReview('READY_FOR_CHECKOUT'));
  assertFalse(shouldRevertGuestFieldEditsToPendingReview('COMPLETED'));
});

Deno.test('canGuestPublicUpdateForm — only PENDING_REVIEW', () => {
  assert(canGuestPublicUpdateForm('PENDING_REVIEW'));
  assertFalse(canGuestPublicUpdateForm('PENDING_DOCUMENTS'));
  assertFalse(canGuestPublicUpdateForm(null));
});

Deno.test('bookingPipeline — hides PENDING_SD_REFUND when security_deposit is 0', () => {
  const pipeline = bookingPipeline({ security_deposit: 0 }, 'PENDING_REVIEW');
  assertFalse(pipeline.includes('PENDING_SD_REFUND'));
  assert(pipeline.includes('READY_FOR_CHECKOUT'));
});

Deno.test('bookingPipeline — D2 empty document requirements skips PENDING_DOCUMENTS', () => {
  const pipeline = bookingPipeline({}, 'PENDING_REVIEW', []);
  assertFalse(pipeline.includes('PENDING_DOCUMENTS'));
  assert(pipeline.includes('READY_FOR_CHECKIN'));
});

Deno.test('nextStep — advances along filtered pipeline', () => {
  assertEquals(nextStep({ security_deposit: 1000 }, 'PENDING_REVIEW'), 'PENDING_DOCUMENTS');
  assertEquals(nextStep({ security_deposit: 0 }, 'READY_FOR_CHECKOUT'), 'COMPLETED');
});

Deno.test('pendingDocumentsClearPatchForGuestEditRevert clears nested completion fields', () => {
  const patch = pendingDocumentsClearPatchForGuestEditRevert();
  assertEquals(patch.gaf_completed_at, null);
  assertEquals(patch.parking_completed_at, null);
  assertEquals(patch.approved_gaf_pdf_url, null);
  assertEquals(patch.guest_balance_paid_amount, null);
  assertEquals(patch.surprise_decor_staff_acknowledged, false);
});

Deno.test('requestPdfClearPatchForChangedFormFields — GAF vs pet invalidation', () => {
  assertEquals(Object.keys(requestPdfClearPatchForChangedFormFields(['checkInDate'])), [
    'gaf_request_pdf_url',
  ]);
  assertEquals(Object.keys(requestPdfClearPatchForChangedFormFields(['petName'])), [
    'pet_request_pdf_url',
  ]);
  assertEquals(requestPdfClearPatchForChangedFormFields(['unknownField']), {});
});
