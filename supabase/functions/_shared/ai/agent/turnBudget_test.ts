import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  createTurnDeadline,
  DEFAULT_TURN_DEADLINE_MS,
  MIN_MS_FOR_ANOTHER_ROUND,
  turnDeadlineMsFromEnv,
} from './turnBudget.ts';

Deno.test('deadline has room at the start and loses it near the end', () => {
  let t = 1_000;
  const deadline = createTurnDeadline(110_000, () => t);
  assert(deadline.hasRoomForAnotherRound());
  t += 59_000;
  assert(deadline.hasRoomForAnotherRound());
  t += 2_000; // 61s elapsed, 49s left
  assertEquals(deadline.hasRoomForAnotherRound(), false);
  assertEquals(deadline.remainingMs(), 49_000);
});

Deno.test('remaining time never goes negative', () => {
  let t = 0;
  const deadline = createTurnDeadline(10_000, () => t, 1);
  t = 99_999;
  assertEquals(deadline.remainingMs(), 0);
  assertEquals(deadline.hasRoomForAnotherRound(), false);
});

Deno.test('the default budget leaves room for synth, guard and commit after the last round', () => {
  assert(DEFAULT_TURN_DEADLINE_MS - MIN_MS_FOR_ANOTHER_ROUND >= 45_000);
});

Deno.test('env override ignores garbage and out-of-range values', () => {
  assertEquals(turnDeadlineMsFromEnv(undefined), DEFAULT_TURN_DEADLINE_MS);
  assertEquals(turnDeadlineMsFromEnv(''), DEFAULT_TURN_DEADLINE_MS);
  assertEquals(turnDeadlineMsFromEnv('abc'), DEFAULT_TURN_DEADLINE_MS);
  assertEquals(turnDeadlineMsFromEnv('5'), DEFAULT_TURN_DEADLINE_MS);
  assertEquals(turnDeadlineMsFromEnv('9999999'), DEFAULT_TURN_DEADLINE_MS);
  assertEquals(turnDeadlineMsFromEnv('90000'), 90_000);
});
