import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  summarizeAssistantTurnTelemetry,
  type PlanOutcomeRow,
  type TurnTelemetryRow,
} from './assistantTurnTelemetrySummary.ts';

const turnRow = (overrides: Partial<TurnTelemetryRow> = {}): TurnTelemetryRow => ({
  turns: '20',
  avg_rounds: 2.4,
  p50_rounds: 2,
  p95_rounds: 5,
  turns_with_plan: '4',
  avg_plan_size: 3.25,
  completion_miss_turns: '2',
  avg_credits: 9.1,
  p50_credits: 8,
  p95_credits: 20,
  ...overrides,
});

const planRow = (overrides: Partial<PlanOutcomeRow> = {}): PlanOutcomeRow => ({
  status: 'completed',
  plans: 3,
  total_steps: 7,
  failed_steps: 0,
  ...overrides,
});

Deno.test('summarizeAssistantTurnTelemetry coerces bigint strings and rounds rates', () => {
  const summary = summarizeAssistantTurnTelemetry(
    [turnRow()],
    [
      planRow({ status: 'completed', plans: 3, total_steps: 7, failed_steps: 0 }),
      planRow({ status: 'partially_failed', plans: 1, total_steps: 3, failed_steps: 1 }),
      planRow({ status: 'cancelled', plans: 1, total_steps: 0, failed_steps: 0 }),
      planRow({ status: 'proposed', plans: 2, total_steps: 0, failed_steps: 0 }),
    ]
  );

  assertEquals(summary.turns, 20);
  assertEquals(summary.avgRounds, 2.4);
  assertEquals(summary.p95Rounds, 5);
  assertEquals(summary.turnsWithPlan, 4);
  assertEquals(summary.avgPlanSize, 3.3);
  assertEquals(summary.completionMissTurns, 2);
  assertEquals(summary.completionMissRatePct, 10);
  assertEquals(summary.avgCredits, 9.1);

  assertEquals(summary.totalPlans, 7);
  assertEquals(
    summary.planOutcomes.map((b) => b.status),
    ['completed', 'proposed', 'partially_failed', 'cancelled']
  );
  // approved (completed + partially_failed) = 4, cancelled = 1, decided = 5 -> 80%
  assertEquals(summary.approvalRatePct, 80);
  assertEquals(summary.cancelledRatePct, 20);
  // failed steps 1 / total steps attempted (7 + 3) = 10 -> 10%
  assertEquals(summary.stepFailureRatePct, 10);
});

Deno.test('summarizeAssistantTurnTelemetry on no rows is empty, not an error', () => {
  const summary = summarizeAssistantTurnTelemetry([], []);
  assertEquals(summary.turns, 0);
  assertEquals(summary.avgRounds, null);
  assertEquals(summary.turnsWithPlan, 0);
  assertEquals(summary.avgPlanSize, null);
  assertEquals(summary.completionMissRatePct, null);
  assertEquals(summary.planOutcomes, []);
  assertEquals(summary.totalPlans, 0);
  assertEquals(summary.approvalRatePct, null);
  assertEquals(summary.stepFailureRatePct, null);
});

Deno.test(
  'summarizeAssistantTurnTelemetry never divides by zero when no plan ever ran a step',
  () => {
    const summary = summarizeAssistantTurnTelemetry(
      [turnRow({ turns_with_plan: '1', avg_plan_size: 2 })],
      [planRow({ status: 'cancelled', plans: 1, total_steps: 0, failed_steps: 0 })]
    );
    assertEquals(summary.stepFailureRatePct, null);
    assertEquals(summary.approvalRatePct, 0);
    assertEquals(summary.cancelledRatePct, 100);
  }
);
