/**
 * Plan-card approval for multi-step writes — Phase 3 of
 * docs/workflow/in-progress/agentic-ai-assistants.md. Pure helpers only (no DB/network calls) so
 * the dependency/placeholder/step-cap logic is unit-testable without a live stack; the edge
 * handlers (dashboard-assistant-chat, dashboard-assistant-confirm) own the DB reads/writes and
 * call into these.
 *
 * A plan step reuses the exact same tool-execution paths a standalone action already uses:
 *  - tier2_confirmed steps run through `executeConfirmedAction` (dashboardAssistantTools.ts),
 *    same as the single-action confirm path — RBAC + assertActionSafeToExecute happen inside the
 *    tool handler itself, so a plan step gets the identical per-call safety re-check "for free".
 *  - tier1_auto steps run through `executeTool` with `deferWritesUntilCommit: false`, same as
 *    `commitDeferredTier1Writes` already does for a standalone turn's deferred writes.
 */

/** Hard cap on steps a single plan can hold — matches the plan doc's "step cap (e.g. 10)". */
export const PLAN_STEP_CAP = 10;

const PLACEHOLDER_RE = /\{\{\s*step(\d+)\.([a-zA-Z0-9_.]+)\s*\}\}/g;
/** Matches only when the ENTIRE string is one placeholder — lets the resolved value keep its
 * real type (number/object) instead of being stringified, unlike a partial-string interpolation. */
const WHOLE_STRING_PLACEHOLDER_RE = /^\{\{\s*step(\d+)\.([a-zA-Z0-9_.]+)\s*\}\}$/;

export type PlanStepRisk = 'tier1_auto' | 'tier2_confirmed';
export type PlanStepStatus =
  'proposed' | 'confirmed' | 'executed' | 'failed' | 'denied' | 'expired';

export type PlanStepDraft = {
  toolName: string;
  riskTier: PlanStepRisk;
  /** For tier2_confirmed: the proposal's result.data (what executeConfirmedAction expects).
   * For tier1_auto: the raw tool-call arguments (what executeTool expects). */
  inputPayload: Record<string, unknown>;
  summary: string;
  details: Array<{ label: string; value: string }>;
  diff?: unknown;
  isExternalSend?: boolean;
};

/**
 * Finds every `{{stepN.path}}` token referenced anywhere in a step's payload (nested
 * objects/arrays included) and returns the distinct, ascending list of step indexes it depends
 * on. A step with no placeholders has no dependencies.
 */
export function findStepDependencies(payload: Record<string, unknown>): number[] {
  const deps = new Set<number>();
  const scan = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(PLACEHOLDER_RE)) {
        const idx = Number(match[1]);
        if (Number.isFinite(idx)) deps.add(idx);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(scan);
    }
  };
  scan(payload);
  return [...deps].sort((a, b) => a - b);
}

function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      obj
    );
}

/**
 * Resolves every `{{stepN.path}}` token in a step's payload against the real results of earlier
 * steps that already ran this confirm. A whole-string placeholder (the entire field is one
 * token) resolves to the referenced value's real type; a token embedded in a larger string is
 * stringified in place. A token that can't be resolved (missing step, missing path) is left
 * untouched — the tool call then fails naturally against a literal `{{...}}` string rather than
 * silently substituting `undefined`, so a broken dependency surfaces as a clear per-step error
 * instead of a confusing downstream failure.
 */
export function resolveStepPlaceholders(
  payload: Record<string, unknown>,
  priorResults: ReadonlyMap<number, unknown>
): Record<string, unknown> {
  const resolveValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const whole = WHOLE_STRING_PLACEHOLDER_RE.exec(value.trim());
      if (whole) {
        const stepIdx = Number(whole[1]);
        if (!priorResults.has(stepIdx)) return value;
        const resolved = getPath(priorResults.get(stepIdx), whole[2]);
        return resolved === undefined ? value : resolved;
      }
      return value.replace(PLACEHOLDER_RE, (fullMatch, stepIdxStr: string, path: string) => {
        const stepIdx = Number(stepIdxStr);
        if (!priorResults.has(stepIdx)) return fullMatch;
        const resolved = getPath(priorResults.get(stepIdx), path);
        return resolved == null ? fullMatch : String(resolved);
      });
    }
    if (Array.isArray(value)) return value.map(resolveValue);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        out[key] = resolveValue(val);
      }
      return out;
    }
    return value;
  };
  return resolveValue(payload) as Record<string, unknown>;
}

/** Caps a drafted step list at PLAN_STEP_CAP, reporting how many were dropped. */
export function capPlanSteps<T>(
  steps: T[],
  cap: number = PLAN_STEP_CAP
): { kept: T[]; overflow: number } {
  if (steps.length <= cap) return { kept: steps, overflow: 0 };
  return { kept: steps.slice(0, cap), overflow: steps.length - cap };
}

/**
 * Transitively propagates failure through `dependsOn`: a step that depends (directly or through
 * a chain) on a failed or already-skipped step is skipped too, never attempted. Independent
 * steps (no dependency on a failed one) are unaffected and still run.
 */
export function stepsToSkipForFailure(
  steps: ReadonlyArray<{ stepIndex: number; dependsOn: readonly number[] }>,
  failedIndexes: ReadonlySet<number>
): Set<number> {
  const skip = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of steps) {
      if (skip.has(step.stepIndex)) continue;
      if (step.dependsOn.some((dep) => failedIndexes.has(dep) || skip.has(dep))) {
        skip.add(step.stepIndex);
        changed = true;
      }
    }
  }
  return skip;
}

/** Final plan status from the per-step outcome after a confirm run finishes. */
export function derivePlanStatus(
  steps: ReadonlyArray<{ selected: boolean; status: PlanStepStatus }>
): 'completed' | 'partially_failed' | 'cancelled' {
  const selected = steps.filter((s) => s.selected);
  if (selected.length === 0) return 'cancelled';
  const allOk = selected.every((s) => s.status === 'executed');
  // No distinct "all failed" status exists in the plan doc's state machine — a run where every
  // selected step failed is still "partially_failed" at the plan level; the per-step `status`
  // field is what actually distinguishes executed/failed/skipped for the host.
  return allOk ? 'completed' : 'partially_failed';
}
