/**
 * Classifies a failed assistant tool call once, for two different audiences:
 *  - `hostFacingToolFailureReason`: a short, plain sentence for the progress "?" hint.
 *  - `modelFacingToolFailureHint`: an imperative instruction appended to the functionResponse
 *    error so the model knows what to do next (retry, fix arguments, or stop and tell the host).
 * Raw tool errors can carry internal text (ids, column names, stack-ish messages), so they are
 * always mapped to a fixed set of plain sentences and never forwarded verbatim to either.
 */

export type ToolFailureClass =
  | 'scope_missing'
  | 'permission_denied'
  | 'plan_denied'
  | 'not_found'
  | 'retryable'
  | 'invalid_arguments'
  | 'unknown';

const FAILURE_PATTERNS: Array<{ pattern: RegExp; failureClass: ToolFailureClass }> = [
  {
    pattern: /no parking in scope|parkingId is required/i,
    failureClass: 'scope_missing',
  },
  {
    pattern: /no property in scope|propertyId is required|property is required/i,
    failureClass: 'scope_missing',
  },
  {
    pattern: /access restricted|permission|forbidden|not allowed|unauthori[sz]ed/i,
    failureClass: 'permission_denied',
  },
  {
    pattern: /\bplan\b|upgrade/i,
    failureClass: 'plan_denied',
  },
  {
    pattern: /not found|no such|does not exist/i,
    failureClass: 'not_found',
  },
  {
    pattern: /timeout|timed out|deadline|network|fetch failed|ECONN/i,
    failureClass: 'retryable',
  },
  {
    pattern: /is required|are required|invalid|malformed|must be|too long/i,
    failureClass: 'invalid_arguments',
  },
];

const HOST_FACING_REASON: Record<ToolFailureClass, string> = {
  scope_missing: 'This check works on one listing at a time, so it was skipped.',
  permission_denied: "Your role can't view this, so it was skipped.",
  plan_denied: 'Not included in your current plan.',
  not_found: "Couldn't find that item. It may have been removed.",
  retryable: 'The check took too long. Try again in a moment.',
  invalid_arguments: 'Some details were missing for this check. Try rephrasing your question.',
  unknown: "This check couldn't run, so it was skipped.",
};

/** Scope-specific host sentence kept distinct for parking vs. property (same class, different copy). */
const SCOPE_REASON_OVERRIDE: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /no parking in scope|parkingId is required/i,
    reason: 'This check works on one parking space at a time, so it was skipped.',
  },
];

export const DEFAULT_TOOL_FAILURE_REASON = HOST_FACING_REASON.unknown;

/** Classifies a raw tool error into a fixed set of failure classes. Pure, no side effects. */
export function classifyToolFailure(error: string | null | undefined): ToolFailureClass {
  const text = String(error ?? '');
  for (const { pattern, failureClass } of FAILURE_PATTERNS) {
    if (pattern.test(text)) return failureClass;
  }
  return 'unknown';
}

export function hostFacingToolFailureReason(error: string | null | undefined): string {
  const text = String(error ?? '');
  for (const { pattern, reason } of SCOPE_REASON_OVERRIDE) {
    if (pattern.test(text)) return reason;
  }
  return HOST_FACING_REASON[classifyToolFailure(error)];
}

const MODEL_FACING_HINT: Record<ToolFailureClass, string> = {
  scope_missing: 'Do not retry as-is — call it again with the specific property or parking scope.',
  permission_denied:
    "Do not retry — the host's role cannot access this. Tell them plainly and move on.",
  plan_denied:
    "Do not retry — this is not included in the host's current plan. Tell them plainly and move on.",
  not_found: 'Do not retry with the same id — confirm the target exists first, or tell the host.',
  retryable:
    'This looks temporary — retry once with the same arguments, then tell the host if it fails again.',
  invalid_arguments:
    'Do not retry as-is — fix the arguments (likely missing or malformed) and try again.',
  unknown: 'Do not retry more than once. If it fails again, tell the host plainly and move on.',
};

/** Imperative instruction appended to the model-facing functionResponse error. */
export function modelFacingToolFailureHint(failureClass: ToolFailureClass): string {
  return MODEL_FACING_HINT[failureClass];
}
