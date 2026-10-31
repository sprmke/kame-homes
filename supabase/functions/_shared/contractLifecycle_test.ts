/**
 * Fixtures / assertions for contract lifecycle day rules (Unit handoff Phase B).
 * Run: deno test --allow-env supabase/functions/_shared/contractLifecycle_test.ts
 */

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  CONSIDERATION_MAX_DAYS,
  canOwnerSubmitConsideration,
  daysSinceContractEnd,
  daysUntilContractEnd,
  emptyContractLegLifecycle,
  hasActiveConsiderationGrant,
  isInGracePeriod,
  markNoticeSent,
  maxGrantedUntilYmd,
  shouldArchiveAtT0,
  shouldLockAtT5,
  shouldRevokeExpiredGrant,
  shouldSendGraceReminder,
  shouldSendPreExpiryNotice,
  validateGrantedUntil,
} from './contractLifecycle.ts';

Deno.test('daysUntil / daysSince around contract end', () => {
  assertEquals(daysUntilContractEnd('2026-08-20', '2026-08-05'), 15);
  assertEquals(daysUntilContractEnd('2026-08-20', '2026-08-13'), 7);
  assertEquals(daysUntilContractEnd('2026-08-20', '2026-08-19'), 1);
  assertEquals(daysUntilContractEnd('2026-08-20', '2026-08-20'), 0);
  assertEquals(daysUntilContractEnd('2026-08-20', '2026-08-21'), -1);
  assertEquals(daysSinceContractEnd('2026-08-20', '2026-08-19'), null);
  assertEquals(daysSinceContractEnd('2026-08-20', '2026-08-20'), 0);
  assertEquals(daysSinceContractEnd('2026-08-20', '2026-08-25'), 5);
});

Deno.test('T−15 / T−7 / T−1 notice idempotency', () => {
  const end = '2026-08-20';
  let life = emptyContractLegLifecycle();
  assert(shouldSendPreExpiryNotice(end, 't_minus_15', life.noticesSent, '2026-08-05'));
  assert(!shouldSendPreExpiryNotice(end, 't_minus_15', life.noticesSent, '2026-08-06'));
  life = markNoticeSent(life, 't_minus_15', '2026-08-05T00:00:00Z');
  assert(!shouldSendPreExpiryNotice(end, 't_minus_15', life.noticesSent, '2026-08-05'));
  assert(shouldSendPreExpiryNotice(end, 't_minus_7', life.noticesSent, '2026-08-13'));
  assert(shouldSendPreExpiryNotice(end, 't_minus_1', life.noticesSent, '2026-08-19'));
});

Deno.test('grace T+0…T+4 and T+5 lock', () => {
  const end = '2026-08-20';
  assert(isInGracePeriod(end, '2026-08-20'));
  assert(isInGracePeriod(end, '2026-08-24'));
  assert(!isInGracePeriod(end, '2026-08-25'));
  assert(!isInGracePeriod(end, '2026-08-19'));

  const life = emptyContractLegLifecycle();
  assert(shouldArchiveAtT0(end, life.noticesSent, '2026-08-20'));
  assert(shouldSendGraceReminder(end, life.noticesSent, '2026-08-23'));
  assert(!shouldSendGraceReminder(end, life.noticesSent, '2026-08-22'));
  assert(shouldLockAtT5(end, life, '2026-08-25'));
  assert(!shouldLockAtT5(end, life, '2026-08-24'));
});

Deno.test('14-day consideration grant rules', () => {
  const today = '2026-08-20';
  assertEquals(maxGrantedUntilYmd(today), '2026-09-03');
  assertEquals(CONSIDERATION_MAX_DAYS, 14);
  assertEquals(validateGrantedUntil('2026-09-03', today), null);
  assert(validateGrantedUntil('2026-09-04', today) != null);
  assert(validateGrantedUntil('2026-08-19', today) != null);

  const end = '2026-08-20';
  let life = emptyContractLegLifecycle();
  assertEquals(canOwnerSubmitConsideration(life, end, '2026-08-21').ok, true);
  life = {
    ...life,
    consideration: {
      ...life.consideration,
      selfServeUsedThisCycle: true,
    },
  };
  assertEquals(canOwnerSubmitConsideration(life, end, '2026-08-21').ok, false);

  life = emptyContractLegLifecycle();
  life = {
    ...life,
    consideration: {
      ...life.consideration,
      status: 'granted',
      grantedUntil: '2026-08-30',
    },
  };
  assert(hasActiveConsiderationGrant(life, '2026-08-25'));
  assert(!shouldLockAtT5(end, life, '2026-08-25'));
  assert(shouldRevokeExpiredGrant(life, '2026-08-31'));
  assert(!shouldRevokeExpiredGrant(life, '2026-08-30'));
});
