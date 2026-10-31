import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  primaryModuleFor,
  totalModelMs,
  totalToolMs,
  TurnTimer,
} from './dashboardAssistantTurnTiming.ts';

function fakeClock(start = 1_000) {
  let now = start;
  return {
    now: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

Deno.test('TurnTimer records each phase and the wall-clock total', async () => {
  const clock = fakeClock();
  const timer = new TurnTimer(clock.now);
  timer.setModules(['core', 'bookings']);

  await timer.measure('preload', async () => clock.advance(120));
  await timer.measure('model', async () => clock.advance(900));
  await timer.measureTool('list_bookings', async () => clock.advance(250));
  await timer.measure('model', async () => clock.advance(700));
  await timer.measure('synth', async () => clock.advance(600));
  await timer.measure('guard', async () => clock.advance(400));
  timer.setGuardMode('llm');
  await timer.measure('commit', async () => clock.advance(30));

  const snapshot = timer.snapshot();
  assertEquals(snapshot.preload_ms, 120);
  assertEquals(snapshot.model_ms, [900, 700]);
  assertEquals(snapshot.tools_ms, [{ name: 'list_bookings', ms: 250 }]);
  assertEquals(snapshot.synth_ms, 600);
  assertEquals(snapshot.guard_ms, 400);
  assertEquals(snapshot.commit_ms, 30);
  assertEquals(snapshot.total_ms, 3_000);
  assertEquals(snapshot.guard_mode, 'llm');
  assertEquals(snapshot.rounds, 2);
  assertEquals(snapshot.primary_module, 'bookings');
  assertEquals(snapshot.synth_inline, false);
  assertEquals(totalToolMs(snapshot), 250);
  assertEquals(totalModelMs(snapshot), 1_600);
});

Deno.test('TurnTimer still records a phase when the measured call throws', async () => {
  const clock = fakeClock();
  const timer = new TurnTimer(clock.now);
  await assertRejects(() =>
    timer.measure('model', async () => {
      clock.advance(50);
      throw new Error('boom');
    })
  );
  assertEquals(timer.snapshot().model_ms, [50]);
});

Deno.test('TurnTimer leaves unmeasured phases null and defaults to the core module', () => {
  const snapshot = new TurnTimer(fakeClock().now).snapshot();
  assertEquals(snapshot.preload_ms, null);
  assertEquals(snapshot.synth_ms, null);
  assertEquals(snapshot.guard_ms, null);
  assertEquals(snapshot.commit_ms, null);
  assertEquals(snapshot.guard_mode, null);
  assertEquals(snapshot.primary_module, 'core');
  assertEquals(snapshot.modules, []);
});

Deno.test('markSynthInline reports zero synth time instead of null', () => {
  const timer = new TurnTimer(fakeClock().now);
  timer.markSynthInline();
  const snapshot = timer.snapshot();
  assertEquals(snapshot.synth_inline, true);
  assertEquals(snapshot.synth_ms, 0);
});

Deno.test('snapshot is a copy: later mutation does not change an earlier snapshot', () => {
  const timer = new TurnTimer(fakeClock().now);
  timer.recordTool('get_booking', 10);
  const first = timer.snapshot();
  timer.recordTool('get_booking_documents', 20);
  assertEquals(first.tools_ms.length, 1);
  assertEquals(timer.snapshot().tools_ms.length, 2);
});

Deno.test('primaryModuleFor skips core and falls back to core', () => {
  assertEquals(primaryModuleFor(['core', 'finance', 'analytics']), 'finance');
  assertEquals(primaryModuleFor(['core']), 'core');
  assertEquals(primaryModuleFor([]), 'core');
});
