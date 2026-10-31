/**
 * Assistant reply feedback rollup for the super-admin AI usage tab (thumbs from
 * `ai_dashboard_assistant_feedback`). Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 5).
 */

export type AssistantFeedbackRow = {
  rating: number;
  reason: string | null;
  created_at: string;
  organization_id: string;
};

export type AssistantFeedbackSummary = {
  up: number;
  down: number;
  /** Share of thumbs-up, 0–100, or null with no ratings. */
  positivePct: number | null;
  recentNegative: Array<{ reason: string | null; createdAt: string; orgName: string | null }>;
};

const RECENT_NEGATIVE_MAX = 10;

export function summarizeAssistantFeedback(
  rows: AssistantFeedbackRow[],
  orgName: (organizationId: string) => string | null
): AssistantFeedbackSummary {
  let up = 0;
  let down = 0;
  for (const row of rows) {
    if (row.rating === 1) up += 1;
    else if (row.rating === -1) down += 1;
  }
  const total = up + down;
  const recentNegative = rows
    .filter((row) => row.rating === -1)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, RECENT_NEGATIVE_MAX)
    .map((row) => ({
      reason: row.reason,
      createdAt: row.created_at,
      orgName: orgName(row.organization_id),
    }));
  return {
    up,
    down,
    positivePct: total === 0 ? null : Math.round((up / total) * 100),
    recentNegative,
  };
}
