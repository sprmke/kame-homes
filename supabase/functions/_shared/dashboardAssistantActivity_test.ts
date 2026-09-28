import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { TurnActivityRecorder } from './dashboardAssistantActivity.ts';
import type { AssistantStreamEvent } from './dashboardAssistantStreamEvents.ts';

function timelineTools(recorder: TurnActivityRecorder) {
  const block = recorder.buildBlock() as { entries: Array<{ phase: string; toolName?: string }> };
  return (block?.entries ?? []).filter((e) => e.phase === 'tool').map((e) => e.toolName);
}

Deno.test('queued Tier 1 writes stream progress but only the commit adds a timeline row', () => {
  const events: AssistantStreamEvent[] = [];
  const recorder = new TurnActivityRecorder((event) => events.push(event));

  recorder.recordToolComplete('remember_preference', true, Date.now(), 'r0-t0', undefined, {
    omitFromTimeline: true,
  });
  assertEquals(timelineTools(recorder), []);
  assertEquals(
    events.map((e) => e.type),
    ['tool_done', 'plan_update']
  );

  recorder.recordToolComplete('remember_preference', true, Date.now());
  assertEquals(timelineTools(recorder), ['remember_preference']);
});

Deno.test('consecutive identical tool rows collapse into one', () => {
  const recorder = new TurnActivityRecorder();
  recorder.recordToolComplete('list_bookings', true, Date.now());
  recorder.recordToolComplete('list_bookings', true, Date.now());
  assertEquals(timelineTools(recorder), ['list_bookings']);
});
