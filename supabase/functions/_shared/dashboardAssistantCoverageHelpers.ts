import type { SuperhostCriteriaSnapshot } from './superhostMetrics.ts';

export const COVERAGE_READ_TOOL_NAMES = [
  'list_guest_reviews',
  'get_review_summary',
  'get_rewards_summary',
  'list_vouchers',
  'get_superhost_status',
  'get_setup_guide_progress',
  'list_marketing_themes',
  'get_marketing_theme',
  'get_analytics_demographics',
  'list_notifications',
  'get_stay_guide_content',
  'get_custom_page_content',
  'search_help_center',
] as const;

export type CoverageToolName = (typeof COVERAGE_READ_TOOL_NAMES)[number];

export function isCoverageTool(name: string): name is CoverageToolName {
  return (COVERAGE_READ_TOOL_NAMES as readonly string[]).includes(name);
}

export function sanitizeHelpQuery(query: string | null): string | null {
  if (!query) return null;
  const safe = query
    .replace(/[%_,()]/g, ' ')
    .slice(0, 80)
    .trim();
  return safe || null;
}

export function formatSuperhostCriteria(criteria: SuperhostCriteriaSnapshot): Array<{
  id: string;
  label: string;
  met: boolean;
  current: string;
}> {
  const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;
  return [
    {
      id: 'stays',
      label: '10 completed stays in the last 12 months',
      met: criteria.activity.met,
      current: String(criteria.activity.value),
    },
    {
      id: 'rating',
      label: '4.8 average rating',
      met: criteria.rating.met,
      current: String(criteria.rating.value),
    },
    {
      id: 'response',
      label: '90% response rate within 24 hours',
      met: criteria.responseRate.met,
      current: pct(criteria.responseRate.value),
    },
    {
      id: 'cancellation',
      label: 'Under 1% cancellation rate',
      met: criteria.cancellationRate.met,
      current: pct(criteria.cancellationRate.value),
    },
  ];
}
