/**
 * Deterministic briefing cards for the AI mode home (no LLM call). Built from the same
 * `computeDashboardStats().attention` list the dashboards show, so the numbers always match.
 * Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 5, briefing home).
 */

import type { DashboardAttentionItem, DashboardAttentionSeverity } from './dashboardService.ts';

export const BRIEFING_CARD_MAX = 6;

export type BriefingCard = {
  id: string;
  label: string;
  count: number;
  severity: DashboardAttentionSeverity;
  /** Sent as the chat message when the card is tapped. */
  prompt: string;
  /** Legacy flat dashboard href (`/bookings?…`); the client rewrites it to the current scope. */
  href: string;
};

const PROMPTS: Record<string, string> = {
  'pending-review': 'Which bookings are waiting for my review, and what does each one need?',
  'pending-documents': 'Which bookings are still waiting on documents?',
  'check-ins-today': 'Who is checking in today, and is anything missing?',
  'check-outs-today': 'Who is checking out today?',
  'pending-sd-refund': 'Which security deposit refunds are still pending?',
  'unpaid-balance': 'Which guests still have an unpaid balance?',
};

const SEVERITY_RANK: Record<DashboardAttentionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function buildBriefingCards(attention: DashboardAttentionItem[]): BriefingCard[] {
  return attention
    .filter((item) => item.count > 0)
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) => SEVERITY_RANK[a.item.severity] - SEVERITY_RANK[b.item.severity] || a.index - b.index
    )
    .slice(0, BRIEFING_CARD_MAX)
    .map(({ item }) => ({
      id: item.id,
      label: item.label,
      count: item.count,
      severity: item.severity,
      prompt: PROMPTS[item.id] ?? `Tell me about: ${item.label.toLowerCase()}`,
      href: item.href,
    }));
}
