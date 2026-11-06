import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  BOOKING_PATCH_ALLOWED_COLUMNS,
  BOOKING_PATCH_COLUMN_PERMISSIONS,
  assertBookingPropertyScope,
  bookingAssetClearPatch,
  assertStayDateOrder,
  canRescheduleBookingAtStatus,
  impliedBookingPatchColumns,
  parseBookingDetailsOperation,
  parkingEditResetPatch,
  requiredPermissionsForOperation,
  requiredPermissionsForPatchColumns,
  requestPdfClearPatchForAdminPayload,
  sanitizeBookingPatchPayload,
} from './bookingDetailsPatch.ts';
import { DEFAULT_DOCUMENT_REQUIREMENTS, parseDocRejectionReason } from './documentRequirements.ts';

Deno.test('requiredPermissionsForPatchColumns maps stay vs pricing leaves', () => {
  assertEquals(requiredPermissionsForPatchColumns(['check_in_date']), [
    'bookings.detail.stay:edit',
  ]);
  assertEquals(requiredPermissionsForPatchColumns(['guest_email']), [
    'bookings.detail.guests:edit',
  ]);
  assertEquals(requiredPermissionsForPatchColumns(['booking_rate']), [
    'bookings.detail.pricing:edit',
  ]);
  assertEquals(
    requiredPermissionsForPatchColumns(['check_in_date', 'booking_rate']).sort(),
    ['bookings.detail.pricing:edit', 'bookings.detail.stay:edit'].sort()
  );
});

Deno.test('requiredPermissionsForOperation - clear_asset uses asset leaf', () => {
  assertEquals(
    requiredPermissionsForOperation('clear_asset', { assetType: 'valid_id' }),
    ['bookings.detail.guests:edit']
  );
  assertEquals(
    requiredPermissionsForOperation('clear_asset', { assetType: 'approved_gaf' }),
    ['bookings.detail.workflow:edit']
  );
});

Deno.test('requiredPermissionsForOperation - reschedule requires stay edit', () => {
  assertEquals(requiredPermissionsForOperation('reschedule', {}), [
    'bookings.detail.stay:edit',
  ]);
});

Deno.test('requiredPermissionsForOperation - review_document requires workflow edit', () => {
  assertEquals(requiredPermissionsForOperation('review_document', { reason: 'expired' }), [
    'bookings.detail.workflow:edit',
  ]);
  assertEquals(parseBookingDetailsOperation('review_document'), 'review_document');
});

Deno.test('parseDocRejectionReason accepts the catalog and rejects anything else', () => {
  assertEquals(parseDocRejectionReason('wrong_document'), 'wrong_document');
  assertEquals(parseDocRejectionReason('other'), 'other');
  assertThrows(() => parseDocRejectionReason('made_up'), Error, 'Select a rejection reason');
  assertThrows(() => parseDocRejectionReason(''), Error, 'Select a rejection reason');
});

Deno.test('sanitizeBookingPatchPayload rejects unknown columns', () => {
  assertThrows(
    () => sanitizeBookingPatchPayload({ status: 'PENDING_REVIEW' }),
    Error,
    'not allowed'
  );
});

Deno.test('sanitizeBookingPatchPayload validates numeric fields', () => {
  const patch = sanitizeBookingPatchPayload({
    booking_rate: 5000,
    down_payment: 1000,
  });
  assertEquals(patch.booking_rate, 5000);
  assertEquals(patch.down_payment, 1000);
});

Deno.test('sanitizeBookingPatchPayload requires real booleans', () => {
  assertThrows(
    () => sanitizeBookingPatchPayload({ need_parking: 'false' }),
    Error,
    'must be a boolean'
  );
  assertEquals(sanitizeBookingPatchPayload({ need_parking: false }).need_parking, false);
  assertEquals(
    sanitizeBookingPatchPayload({ sd_refund_phone_confirmed: null }).sd_refund_phone_confirmed,
    null
  );
});

Deno.test('canRescheduleBookingAtStatus guards checkout onward', () => {
  assertEquals(canRescheduleBookingAtStatus('READY_FOR_CHECKIN'), true);
  assertEquals(canRescheduleBookingAtStatus('READY_FOR_CHECKOUT'), false);
  assertEquals(canRescheduleBookingAtStatus('COMPLETED'), false);
});

Deno.test('bookingAssetClearPatch clears URL and AI columns', () => {
  const patch = bookingAssetClearPatch('payment_receipt');
  assertEquals(patch.payment_receipt_url, null);
  assertEquals(patch.dp_receipt_ai_verdict, null);
  assertEquals(patch.dp_receipt_ai_summary, null);
});

Deno.test('parkingEditResetPatch re-opens parking when it is added', () => {
  const patch = parkingEditResetPatch(
    { need_parking: false },
    { need_parking: true, car_plate_number: 'ABC 123' },
    'PENDING_DOCUMENTS'
  );
  assertEquals(patch, { parking_completed_at: null });
});

Deno.test('parkingEditResetPatch re-opens parking when vehicle details change', () => {
  const patch = parkingEditResetPatch(
    {
      need_parking: true,
      car_plate_number: 'ABC 123',
      car_brand_model: 'Toyota Vios',
      car_color: 'White',
    },
    { need_parking: true, car_plate_number: 'XYZ 789' },
    'READY_FOR_CHECKIN'
  );
  assertEquals(patch, { parking_completed_at: null });
});

Deno.test('parkingEditResetPatch clears settlement when parking is removed', () => {
  const patch = parkingEditResetPatch(
    {
      need_parking: true,
      parking_completed_at: '2026-11-01T00:00:00.000Z',
      parking_owner: 'Owner',
      parking_rate_paid: 500,
      parking_endorsement_url: 'https://example.com/endorsement.png',
    },
    { need_parking: false },
    'PENDING_DOCUMENTS'
  );
  assertEquals(patch.parking_completed_at, null);
  assertEquals(patch.parking_owner, null);
  assertEquals(patch.parking_rate_paid, null);
  assertEquals(patch.parking_endorsement_url, null);
  assertEquals(patch.parking_payment_receipt_url, null);
});

Deno.test('parkingEditResetPatch ignores non-parking edits and post-checkout statuses', () => {
  assertEquals(
    parkingEditResetPatch(
      { need_parking: true, car_plate_number: 'ABC 123' },
      { car_plate_number: 'ABC 123' },
      'PENDING_DOCUMENTS'
    ),
    {}
  );
  assertEquals(
    parkingEditResetPatch(
      { need_parking: false },
      { need_parking: true },
      'READY_FOR_CHECKOUT'
    ),
    {}
  );
});

Deno.test('requestPdfClearPatchForAdminPayload clears GAF URL on date change', () => {
  const patch = requestPdfClearPatchForAdminPayload(
    { check_in_date: '2026-06-01' },
    { check_in_date: '2026-06-02' },
    DEFAULT_DOCUMENT_REQUIREMENTS
  );
  assertEquals(patch.gaf_request_pdf_url, null);
});

Deno.test('BOOKING_PATCH_COLUMN_PERMISSIONS covers every allowlisted patch column', () => {
  for (const column of BOOKING_PATCH_ALLOWED_COLUMNS) {
    assertEquals(typeof BOOKING_PATCH_COLUMN_PERMISSIONS[column], 'string');
  }
});

Deno.test('Airbnb source implies pricing permission for zeroed deposit fields', () => {
  assertEquals(impliedBookingPatchColumns({ booking_source: 'Airbnb' }).sort(), [
    'down_payment',
    'security_deposit',
  ].sort());
  const perms = requiredPermissionsForOperation('patch', {
    payload: { booking_source: 'Airbnb' },
  });
  if (!perms.includes('bookings.detail.stay:edit')) {
    throw new Error('expected stay edit for booking_source');
  }
  if (!perms.includes('bookings.detail.pricing:edit')) {
    throw new Error('expected pricing edit when Airbnb zeros deposits');
  }
});

Deno.test('assertBookingPropertyScope rejects missing and mismatched property_id', () => {
  assertBookingPropertyScope({ property_id: 'prop-1' }, 'prop-1');
  assertThrows(
    () => assertBookingPropertyScope({ property_id: null }, 'prop-1'),
    Error,
    'missing property scope'
  );
  assertThrows(
    () => assertBookingPropertyScope({ property_id: 'prop-2' }, 'prop-1'),
    Error,
    'does not belong'
  );
});

Deno.test('requiredPermissionsForOperation rejects an empty patch', () => {
  assertThrows(
    () => requiredPermissionsForOperation('patch', { payload: {} }),
    Error,
    'No valid fields'
  );
});

Deno.test('sanitizeBookingPatchPayload rejects invalid dates and non-finite money', () => {
  assertThrows(
    () => sanitizeBookingPatchPayload({ check_in_date: 'not-a-date' }),
    Error,
    'valid date'
  );
  assertThrows(
    () => sanitizeBookingPatchPayload({ booking_rate: Number.POSITIVE_INFINITY }),
    Error,
    'must be a number'
  );
  assertThrows(
    () => sanitizeBookingPatchPayload({ booking_rate: '5000' }),
    Error,
    'must be a number'
  );
  assertThrows(
    () => sanitizeBookingPatchPayload({ down_payment: -1 }),
    Error,
    'must not be negative'
  );
  assertEquals(sanitizeBookingPatchPayload({ balance: null }).balance, null);
});

Deno.test('sanitizeBookingPatchPayload allows a blank pet vaccination date', () => {
  assertEquals(
    sanitizeBookingPatchPayload({ pet_vaccination_date: null }).pet_vaccination_date,
    null
  );
  assertEquals(sanitizeBookingPatchPayload({ pet_vaccination_date: '' }).pet_vaccination_date, null);
  assertEquals(
    sanitizeBookingPatchPayload({ pet_vaccination_date: '2026-01-10' }).pet_vaccination_date,
    '2026-01-10'
  );
  assertThrows(
    () => sanitizeBookingPatchPayload({ pet_vaccination_date: 'not-a-date' }),
    Error,
    'valid date'
  );
});

Deno.test('sanitizeBookingPatchPayload validates settlement line items', () => {
  assertThrows(
    () =>
      sanitizeBookingPatchPayload({
        sd_additional_expense_items: [{ label: '', amount: 50 }],
      }),
    Error,
    'is invalid'
  );
  assertThrows(
    () => sanitizeBookingPatchPayload({ sd_additional_profits: [25, -1] }),
    Error,
    'must not be negative'
  );
});

Deno.test('assertStayDateOrder - same-day allowed, inverted rejected', () => {
  assertStayDateOrder('2026-01-10', '2026-01-10');
  assertStayDateOrder('2026-01-10', '2026-01-12');
  assertStayDateOrder('01-10-2026', '01-10-2026');
  assertThrows(() => assertStayDateOrder('2026-01-12', '2026-01-10'));
  assertThrows(() => assertStayDateOrder('not-a-date', '2026-01-10'));
});
