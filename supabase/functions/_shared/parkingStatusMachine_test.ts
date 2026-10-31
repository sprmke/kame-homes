import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { availableTransitions, canTransition, isParkingStatus } from './parkingStatusMachine.ts';

Deno.test('isParkingStatus validates known literals', () => {
  assert(isParkingStatus('PENDING_HOST_ACCEPTANCE'));
  assert(isParkingStatus('PENDING_PAYMENT'));
  assertFalse(isParkingStatus('PENDING_SD_REFUND'));
});

Deno.test('canTransition — host accept to payment window', () => {
  assert(canTransition('PENDING_HOST_ACCEPTANCE', 'PENDING_PAYMENT'));
  assertFalse(canTransition('PENDING_HOST_ACCEPTANCE', 'PENDING_REVIEW'));
});

Deno.test('canTransition — payment to confirmed review', () => {
  assert(canTransition('PENDING_PAYMENT', 'PENDING_REVIEW'));
});

Deno.test('canTransition — terminal statuses have no outbound', () => {
  assertEquals(availableTransitions('COMPLETED'), []);
  assertEquals(availableTransitions('CANCELLED'), []);
  assertEquals(availableTransitions('NO_HOST_AVAILABLE'), []);
});
