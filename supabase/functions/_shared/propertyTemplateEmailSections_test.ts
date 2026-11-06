import { assertStringIncludes, assertNotMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildPaymentBreakdownSectionFromBooking } from './propertyTemplateEmailSections.ts';
import type { GuestSubmission } from './types.ts';

const peso = (amount: number | null | undefined) => `PHP ${amount ?? 0}`;

const baseBooking = {
  booking_rate: 10000,
  down_payment: 0,
  balance: 10000,
  security_deposit: 0,
  has_pets: true,
  pet_fee: 500,
  need_parking: false,
  guest_additional_fee: 0,
} as unknown as GuestSubmission;

Deno.test('Airbnb payment breakdown hides down payment and security deposit rows', () => {
  const html = buildPaymentBreakdownSectionFromBooking(
    { ...baseBooking, booking_source: 'Airbnb' },
    peso,
    500
  );

  assertStringIncludes(html, 'Paid through Airbnb');
  assertNotMatch(html, /Booking rate balance/);
  assertNotMatch(html, /Down payment paid/);
  assertNotMatch(html, /Security deposit/);
});

Deno.test('Direct payment breakdown keeps the full pricing table', () => {
  const html = buildPaymentBreakdownSectionFromBooking(
    { ...baseBooking, booking_source: 'Facebook' },
    peso,
    10500
  );

  assertStringIncludes(html, 'Booking rate balance');
  assertStringIncludes(html, 'Down payment paid');
  assertStringIncludes(html, 'Security deposit');
});
