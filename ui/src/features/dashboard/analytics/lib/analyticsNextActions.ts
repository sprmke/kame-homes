import type {
  AnalyticsForward,
  AnalyticsPlaybookArticle,
  AnalyticsPublicPage,
  AnalyticsStateAssessment,
} from '@/features/dashboard/analytics/lib/types';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

export type AnalyticsNextAction = {
  key: string;
  label: string;
  to?: string;
  action?: 'ai-review';
};

const MAX_ACTIONS = 3;

type Input = {
  orgSlug: string;
  propertySlug: string;
  state: AnalyticsStateAssessment;
  forward: AnalyticsForward;
  publicPage: AnalyticsPublicPage;
  playbook: AnalyticsPlaybookArticle[];
};

/** Deterministic CTAs for the Overview "Do next" list. Max 3. */
export function buildAnalyticsNextActions(input: Input): AnalyticsNextAction[] {
  const { orgSlug, propertySlug, state, forward, publicPage, playbook } = input;
  const pricing = propertySectionPath(orgSlug, propertySlug, 'pricing');
  const marketing = propertySectionPath(orgSlug, propertySlug, 'marketing');
  const bookings = propertySectionPath(orgSlug, propertySlug, 'bookings');
  const openNights = Math.max(0, forward.nightsAvailable - forward.nightsBooked);
  const items: AnalyticsNextAction[] = [];

  if (state.balanceCollectionState !== 'clear' && state.unpaidBalanceUpcomingCount > 0) {
    items.push({ key: 'collect', label: 'Collect balances', to: bookings });
  }

  if (state.forwardOccupancyState30d === 'fully_booked' && openNights > 0) {
    items.push({ key: 'raise', label: 'Raise remaining rates', to: pricing });
  } else if (state.forwardOccupancyState30d === 'underbooked' || openNights > 0) {
    items.push({ key: 'pricing', label: 'Adjust pricing', to: pricing });
  }

  if (state.forwardOccupancyState30d === 'underbooked' || publicPage.pageViews === 0) {
    items.push({ key: 'marketing', label: 'Promote listing', to: marketing });
  }

  const tip = playbook[0]?.title;
  if (items.length < MAX_ACTIONS && tip) {
    items.push({ key: 'playbook', label: tip, action: 'ai-review' });
  }

  if (items.length === 0) {
    items.push({ key: 'review', label: 'See AI review', action: 'ai-review' });
  }

  return items.slice(0, MAX_ACTIONS);
}
