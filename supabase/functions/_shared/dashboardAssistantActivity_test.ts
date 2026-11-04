import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { TurnActivityRecorder, TurnTaskPlanRecorder } from './dashboardAssistantActivity.ts';
import type { AssistantStreamEvent } from './dashboardAssistantStreamEvents.ts';

function timelineTools(recorder: TurnActivityRecorder) {
  const block = recorder.buildBlock() as { entries: Array<{ phase: string; toolName?: string }> };
  return (block?.entries ?? []).filter((e) => e.phase === 'tool').map((e) => e.toolName);
}

Deno.test('queued Tier 1 writes stream progress but only the commit adds a timeline row', () => {
  const events: AssistantStreamEvent[] = [];
  const recorder = new TurnActivityRecorder((event) => events.push(event));

  recorder.recordToolComplete(
    'propose_mark_notifications_read',
    true,
    Date.now(),
    'r0-t0',
    undefined,
    {
      omitFromTimeline: true,
    }
  );
  assertEquals(timelineTools(recorder), []);
  assertEquals(
    events.map((e) => e.type),
    ['tool_done', 'plan_update']
  );

  recorder.recordToolComplete('propose_mark_notifications_read', true, Date.now());
  assertEquals(timelineTools(recorder), ['propose_mark_notifications_read']);
});

Deno.test('consecutive identical tool rows collapse into one', () => {
  const recorder = new TurnActivityRecorder();
  recorder.recordToolComplete('list_bookings', true, Date.now());
  recorder.recordToolComplete('list_bookings', true, Date.now());
  assertEquals(timelineTools(recorder), ['list_bookings']);
});

Deno.test('declareGoals seeds a pending checklist and streams it immediately', () => {
  const events: AssistantStreamEvent[] = [];
  const recorder = new TurnTaskPlanRecorder((event) => events.push(event));
  recorder.declareGoals([
    'Block Dec 24-26',
    'Raise weekend rates 10%',
    'Message the Garcia booking',
  ]);

  const block = recorder.buildBlock() as { steps: Array<{ label: string; status: string }> };
  assertEquals(block.steps.length, 3);
  assertEquals(
    block.steps.every((s) => s.status === 'pending'),
    true
  );
  assertEquals(events[0]?.type, 'plan');
});

Deno.test('declareGoals ignores blank/empty goals', () => {
  const recorder = new TurnTaskPlanRecorder();
  recorder.declareGoals(['  ', '']);
  assertEquals(recorder.buildBlock(), null);
});

Deno.test('advanceDeclaredGoal marks the earliest pending goal done, in order', () => {
  const recorder = new TurnTaskPlanRecorder();
  recorder.declareGoals(['First', 'Second', 'Third']);
  recorder.advanceDeclaredGoal();
  let block = recorder.buildBlock() as { steps: Array<{ label: string; status: string }> };
  assertEquals(block.steps[0]?.status, 'done');
  assertEquals(block.steps[1]?.status, 'pending');

  recorder.advanceDeclaredGoal();
  block = recorder.buildBlock() as { steps: Array<{ label: string; status: string }> };
  assertEquals(block.steps[1]?.status, 'done');
  assertEquals(block.steps[2]?.status, 'pending');

  // No more pending goals — a further advance is a no-op, never throws.
  recorder.advanceDeclaredGoal();
  recorder.advanceDeclaredGoal();
  block = recorder.buildBlock() as { steps: Array<{ label: string; status: string }> };
  assertEquals(
    block.steps.every((s) => s.status === 'done'),
    true
  );
});

Deno.test('advanceDeclaredGoal without declareGoals is a no-op', () => {
  const recorder = new TurnTaskPlanRecorder();
  recorder.advanceDeclaredGoal();
  assertEquals(recorder.buildBlock(), null);
});

Deno.test('a declared-goal plan replaces the per-tool-call inferred checklist', () => {
  const recorder = new TurnTaskPlanRecorder();
  recorder.declareGoals(['First', 'Second']);
  // Would normally seed 2 tool steps + a synth step when 2+ calls happen in a round.
  recorder.initFromToolCalls([{ name: 'list_bookings' }, { name: 'get_booking' }], 0);
  const block = recorder.buildBlock() as { steps: Array<{ label: string }> };
  assertEquals(block.steps.length, 2);
  assertEquals(block.steps[0]?.label, 'First');
});

Deno.test('getOpenSteps reports unfinished declared goals, not the synth placeholder shape', () => {
  const recorder = new TurnTaskPlanRecorder();
  recorder.declareGoals(['First', 'Second', 'Third']);
  recorder.advanceDeclaredGoal();
  assertEquals(
    recorder.getOpenSteps().map((s) => s.label),
    ['Second', 'Third']
  );
});

Deno.test('resumeFrom seeds the plan from a prior turn, keeping done steps done', () => {
  const events: AssistantStreamEvent[] = [];
  const recorder = new TurnTaskPlanRecorder((event) => events.push(event));
  recorder.resumeFrom([
    { id: 'g0', label: 'Block Dec 24-26', status: 'done' },
    { id: 'g1', label: 'Raise weekend rates 10%', status: 'pending' },
    { id: 'g2', label: 'Message the Garcia booking', status: 'pending' },
  ]);
  const block = recorder.buildBlock() as {
    steps: Array<{ id: string; label: string; status: string }>;
  };
  assertEquals(block.steps, [
    { id: 'g0', label: 'Block Dec 24-26', status: 'done' },
    { id: 'g1', label: 'Raise weekend rates 10%', status: 'pending' },
    { id: 'g2', label: 'Message the Garcia booking', status: 'pending' },
  ]);
  assertEquals(events[0]?.type, 'plan');
});

Deno.test('resumeFrom resets a running or failed step back to pending for retry', () => {
  const recorder = new TurnTaskPlanRecorder();
  recorder.resumeFrom([
    { id: 'g0', label: 'First', status: 'done' },
    { id: 'g1', label: 'Second', status: 'running' },
    { id: 'g2', label: 'Third', status: 'failed' },
  ]);
  const block = recorder.buildBlock() as { steps: Array<{ label: string; status: string }> };
  assertEquals(
    block.steps.map((s) => s.status),
    ['done', 'pending', 'pending']
  );
});

Deno.test('resumeFrom drops the prior turn synth placeholder row', () => {
  const recorder = new TurnTaskPlanRecorder();
  recorder.resumeFrom([
    { id: 'g0', label: 'First', status: 'pending' },
    { id: 'g1', label: 'Second', status: 'pending' },
    { id: 'r0-synth', label: 'Prepare your answer', status: 'done' },
  ]);
  assertEquals(
    recorder.getOpenSteps().map((s) => s.label),
    ['First', 'Second']
  );
});

Deno.test('resumeFrom with only a synth row (everything else done) is a no-op', () => {
  const recorder = new TurnTaskPlanRecorder();
  recorder.resumeFrom([{ id: 'r0-synth', label: 'Prepare your answer', status: 'done' }]);
  assertEquals(recorder.buildBlock(), null);
});

Deno.test('advanceDeclaredGoal continues working through a resumed plan', () => {
  const recorder = new TurnTaskPlanRecorder();
  recorder.resumeFrom([
    { id: 'g0', label: 'First', status: 'done' },
    { id: 'g1', label: 'Second', status: 'pending' },
  ]);
  recorder.advanceDeclaredGoal();
  assertEquals(recorder.getOpenSteps(), []);
});
