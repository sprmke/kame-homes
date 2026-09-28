/**
 * Short, host-facing reason for a failed assistant tool step (progress "?" hint).
 * Raw tool errors can carry internal text (ids, column names, stack-ish messages), so they are
 * mapped to a fixed set of plain sentences and never forwarded to the client verbatim.
 */

const FAILURE_REASONS: Array<{ pattern: RegExp; reason: string }> = [
  // Memory refusals (dashboardAssistantMemory.ts) come first: they are not errors to retry.
  { pattern: /already saved/i, reason: 'That is already saved.' },
  { pattern: /you can keep up to \d+/i, reason: 'Memory is full. Remove one first.' },
  { pattern: /instruction cannot be saved/i, reason: "That instruction can't be saved." },
  { pattern: /keep it under \d+ characters/i, reason: 'That is too long to save.' },
  {
    pattern: /no property in scope|propertyId is required|property is required/i,
    reason: 'This check works on one listing at a time, so it was skipped.',
  },
  {
    pattern: /no parking in scope|parkingId is required/i,
    reason: 'This check works on one parking space at a time, so it was skipped.',
  },
  {
    pattern: /access restricted|permission|forbidden|not allowed|unauthori[sz]ed/i,
    reason: "Your role can't view this, so it was skipped.",
  },
  {
    pattern: /\bplan\b|upgrade/i,
    reason: 'Not included in your current plan.',
  },
  {
    pattern: /not found|no such|does not exist/i,
    reason: "Couldn't find that item. It may have been removed.",
  },
  {
    pattern: /timeout|timed out|deadline|network|fetch failed|ECONN/i,
    reason: 'The check took too long. Try again in a moment.',
  },
  {
    pattern: /is required|are required|invalid|malformed|must be|too long/i,
    reason: 'Some details were missing for this check. Try rephrasing your question.',
  },
];

export const DEFAULT_TOOL_FAILURE_REASON = "This check couldn't run, so it was skipped.";

export function hostFacingToolFailureReason(error: string | null | undefined): string {
  const text = String(error ?? '');
  for (const { pattern, reason } of FAILURE_REASONS) {
    if (pattern.test(text)) return reason;
  }
  return DEFAULT_TOOL_FAILURE_REASON;
}
