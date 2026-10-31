/**
 * Shapes the `super_admin_assistant_latency` rollup (migration 20261316127700) for the AI Usage
 * tab: turn latency p50/p95 per primary router module and per guard mode.
 * Mirror of the response type: ui/.../super-admin/hooks/useSuperAdminAiUsage.ts#AssistantLatency.
 */

export type AssistantLatencyRow = {
  dimension: 'module' | 'guard_mode' | string;
  key: string;
  turns: number | string;
  total_p50_ms: number | null;
  total_p95_ms: number | null;
  model_p50_ms: number | null;
  tools_p50_ms: number | null;
  synth_p50_ms: number | null;
  guard_p50_ms: number | null;
};

export type AssistantLatencyBucket = {
  key: string;
  turns: number;
  p50Ms: number | null;
  p95Ms: number | null;
  modelP50Ms: number | null;
  toolsP50Ms: number | null;
  synthP50Ms: number | null;
  guardP50Ms: number | null;
};

export type AssistantLatencySummary = {
  /** Assistant turns with a recorded breakdown in the range. */
  turns: number;
  byModule: AssistantLatencyBucket[];
  byGuardMode: AssistantLatencyBucket[];
};

const int = (value: unknown): number | null => {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
};

function toBucket(row: AssistantLatencyRow): AssistantLatencyBucket {
  return {
    key: row.key,
    turns: int(row.turns) ?? 0,
    p50Ms: int(row.total_p50_ms),
    p95Ms: int(row.total_p95_ms),
    modelP50Ms: int(row.model_p50_ms),
    toolsP50Ms: int(row.tools_p50_ms),
    synthP50Ms: int(row.synth_p50_ms),
    guardP50Ms: int(row.guard_p50_ms),
  };
}

/** Busiest first so the slow, common modules lead the card. */
const byTurnsDesc = (a: AssistantLatencyBucket, b: AssistantLatencyBucket) => b.turns - a.turns;

export function summarizeAssistantLatency(rows: AssistantLatencyRow[]): AssistantLatencySummary {
  const byModule = rows
    .filter((row) => row.dimension === 'module' && row.key)
    .map(toBucket)
    .sort(byTurnsDesc);
  const byGuardMode = rows
    .filter((row) => row.dimension === 'guard_mode' && row.key)
    .map(toBucket)
    .sort(byTurnsDesc);
  return {
    turns: byModule.reduce((sum, bucket) => sum + bucket.turns, 0),
    byModule,
    byGuardMode,
  };
}
