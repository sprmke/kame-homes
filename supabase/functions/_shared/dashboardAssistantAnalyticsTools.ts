/**
 * AI assistant tools — Ask Analytics (Host Analytics module, Phase 4).
 * Plan: docs/workflow/in-progress/host-analytics-module.md
 *
 * Two Tier-0 read tools: `get_property_analytics` (the deterministic AnalyticsBundle,
 * summarized + PHP-formatted for chat) and `explain_metric` (deterministic glossary lookup,
 * no DB access). Kept in its own file — same convention as `dashboardAssistantOpsTools.ts`
 * (channel sync) — rather than growing the ~5,300-line dispatcher directly. Wired into
 * `dashboardAssistantTools.ts`'s import list, switch, and tool-declaration array only
 * (additive, no existing case/list entries touched).
 *
 * Both tools independently re-verify RBAC (`analytics:view`) against the real request JWT —
 * never trust the model's own propertyId. Reads are preview-open (same as `analytics-summary`);
 * `analyticsInsights` gates export and on-demand AI review POST, not these tools.
 */

import { verifyPropertyAccess } from './orgAuth.ts';
import { formatFinancePhp } from './financeService.ts';
import { manilaTodayIso } from './bookingsListSort.ts';
import {
  computeAnalyticsBundle,
  computePlatformBenchmark,
  type AnalyticsBundle,
} from './analyticsService.ts';
import { matchPlaybookArticles } from './hostPlaybook.ts';

export type AnalyticsToolContext = {
  req: Request;
  pageContext: { propertyId?: string | null };
};

export type AnalyticsToolResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  riskTier?: 'tier0_read';
  auditPropertyId?: string | null;
};

function str(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Mirrors ui/.../analytics/lib/analyticsDateRange.ts presets, server-side, chat-facing subset. */
function resolvePeriod(period: string | null): { from: string; to: string } {
  const today = manilaTodayIso();
  switch (period) {
    case 'this_month': {
      const [y, m] = today.split('-').map(Number);
      const from = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      return { from, to: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` };
    }
    case 'last_90d':
      return { from: addDaysIso(today, -89), to: today };
    case 'last_30d':
    default:
      return { from: addDaysIso(today, -29), to: today };
  }
}

function pct(n: number | null): string {
  if (n === null) return 'n/a';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

const OCCUPANCY_STATE_LABEL: Record<string, string> = {
  underbooked: 'Underbooked — worth a pricing and marketing check',
  building: 'Building — occupancy is picking up, keep current approach',
  strong: 'Strong — occupancy is healthy for this listing',
  fully_booked: 'Fully booked — a good time to raise rates on remaining open nights',
};

const BALANCE_STATE_LABEL: Record<string, string> = {
  clear: 'Clear — no upcoming balances at risk',
  attention_needed: 'Attention needed — some upcoming bookings carry unpaid balances',
  at_risk: 'At risk — unpaid balances are due soon on near-term check-ins',
};

async function resolveAnalyticsProperty(
  ctx: AnalyticsToolContext,
  args: Record<string, unknown>
): Promise<string> {
  const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
  if (!propertyId) throw new Error('propertyId is required (no property in scope)');
  await verifyPropertyAccess(ctx.req, propertyId, 'analytics:view');
  return propertyId;
}

function summarizeBundle(bundle: AnalyticsBundle) {
  const k = bundle.kpis;
  return {
    period: bundle.period,
    state: {
      forwardOccupancyState30d: bundle.stateAssessment.forwardOccupancyState30d,
      forwardOccupancyState30dLabel:
        OCCUPANCY_STATE_LABEL[bundle.stateAssessment.forwardOccupancyState30d],
      forwardOccupancyState60d: bundle.stateAssessment.forwardOccupancyState60d,
      balanceCollectionState: bundle.stateAssessment.balanceCollectionState,
      balanceCollectionStateLabel:
        BALANCE_STATE_LABEL[bundle.stateAssessment.balanceCollectionState],
      unpaidBalanceUpcomingTotalDisplay: formatFinancePhp(
        bundle.stateAssessment.unpaidBalanceUpcomingTotal
      ),
      unpaidBalanceUpcomingCount: bundle.stateAssessment.unpaidBalanceUpcomingCount,
    },
    kpis: {
      occupancyRatePct: Math.round(k.occupancyRate.value * 100),
      occupancyRateVsPrior: pct(k.occupancyRate.changePctVsPrior),
      occupancyRateVsLastYear: pct(k.occupancyRate.changePctVsLastYear),
      adrDisplay: formatFinancePhp(k.adr.value),
      adrVsPrior: pct(k.adr.changePctVsPrior),
      revparDisplay: formatFinancePhp(k.revpar.value),
      revparVsPrior: pct(k.revpar.changePctVsPrior),
      grossRevenueDisplay: formatFinancePhp(k.grossRevenue.value),
      grossRevenueVsPrior: pct(k.grossRevenue.changePctVsPrior),
      grossRevenueVsLastYear: pct(k.grossRevenue.changePctVsLastYear),
      netProfitDisplay: formatFinancePhp(k.netProfit.value),
      netProfitVsPrior: pct(k.netProfit.changePctVsPrior),
      reservations: k.reservations.value,
      reservationsVsPrior: pct(k.reservations.changePctVsPrior),
      avgLeadTimeDays: Math.round(k.avgLeadTimeDays.value),
      cancellationRatePct: Math.round(k.cancellationRate.value * 100),
      cancellationRateVsPrior: pct(k.cancellationRate.changePctVsPrior),
      avgRating: Math.round(k.avgRating.value * 10) / 10,
      repeatGuestRatePct: Math.round(k.repeatGuestRate.value * 100),
      avgResponseMinutes: Math.round(k.avgResponseMinutes.value),
      responseWithin24hRatePct: Math.round(k.responseWithin24hRate.value * 100),
    },
    forward: {
      windowDays: bundle.forward.windowDays,
      occupancyOnBooksPct: Math.round(bundle.forward.occupancyOnBooks * 100),
      revenueOnBooksDisplay: formatFinancePhp(bundle.forward.revenueOnBooks),
      openNightsCount: bundle.forward.gapNights.length,
    },
    pickup: bundle.pickup,
    channelMix: bundle.distributions.channelMix
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c) => ({ channel: c.channel, count: c.count })),
    topGuestOrigins: bundle.distributions.guestOrigins.slice(0, 5),
    publicPage: {
      pageViews: bundle.publicPage.pageViews,
      uniqueVisitors: bundle.publicPage.uniqueVisitors,
    },
  };
}

function summarizeBenchmark(benchmark: Awaited<ReturnType<typeof computePlatformBenchmark>>) {
  if (!benchmark.available) {
    return { available: false as const };
  }
  return {
    available: true as const,
    sampleSize: benchmark.sampleSize,
    medianOccupancyRatePct: benchmark.medianOccupancyRate,
    occupancyPercentile: benchmark.occupancyPercentile,
    medianAdrDisplay: benchmark.medianAdr !== null ? formatFinancePhp(benchmark.medianAdr) : null,
    adrPercentile: benchmark.adrPercentile,
  };
}

/** get_property_analytics — the deterministic AnalyticsBundle, summarized for chat. */
export async function toolGetPropertyAnalytics(
  ctx: AnalyticsToolContext,
  args: Record<string, unknown>
): Promise<AnalyticsToolResult> {
  try {
    const propertyId = await resolveAnalyticsProperty(ctx, args);
    const period = resolvePeriod(str(args, 'period'));
    const bundle = await computeAnalyticsBundle({ propertyId, ...period });
    // Best-effort — a benchmark failure must never break the rest of the answer, same contract
    // as analytics-summary's own use of this function.
    const benchmark = await computePlatformBenchmark(
      propertyId,
      period.from,
      period.to,
      bundle.kpis.occupancyRate.value,
      bundle.kpis.adr.value
    ).catch(() => ({
      available: false as const,
      sampleSize: 0,
      medianOccupancyRate: null,
      medianAdr: null,
      occupancyPercentile: null,
      adrPercentile: null,
    }));

    if (!bundle.sufficiency.enough) {
      return {
        ok: true,
        riskTier: 'tier0_read',
        auditPropertyId: propertyId,
        data: {
          propertyId,
          enough: false,
          sampleSize: bundle.sufficiency.sampleSize,
          note: 'Not enough completed booking history yet for a full review (needs 10+ non-cancelled bookings ever). Figures below are still directionally accurate for the selected period.',
          ...summarizeBundle(bundle),
          benchmark: summarizeBenchmark(benchmark),
        },
      };
    }

    const playbook = await matchPlaybookArticles(bundle, 3).catch(() => []);
    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      data: {
        propertyId,
        enough: true,
        ...summarizeBundle(bundle),
        benchmark: summarizeBenchmark(benchmark),
        suggestedPlaybookArticles: playbook.map((a) => ({ title: a.title, category: a.category })),
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

type MetricKey =
  | 'occupancy'
  | 'adr'
  | 'revpar'
  | 'revenue'
  | 'net_profit'
  | 'reservations'
  | 'lead_time'
  | 'cancellation_rate'
  | 'rating'
  | 'repeat_guest_rate'
  | 'response_time'
  | 'response_rate'
  | 'occupancy_on_books'
  | 'pickup'
  | 'forward_occupancy_state'
  | 'balance_collection_state';

const METRIC_EXPLANATIONS: Record<MetricKey, string> = {
  occupancy: 'Occupancy rate = nights booked ÷ nights available in the selected period.',
  adr: 'ADR (Average Daily Rate) = gross lodging revenue ÷ nights booked. What guests pay per night on average, excluding fees.',
  revpar:
    'RevPAR (Revenue per Available Night) = gross lodging revenue ÷ total nights available (booked + open). Combines occupancy and rate into one number.',
  revenue:
    'Gross revenue = total booking revenue (lodging + fees) for reservations with a check-in in the selected period, excluding cancelled bookings.',
  net_profit:
    'Net profit = gross revenue minus operating and stay-related expenses, same math as the Finance page.',
  reservations:
    'Reservations = count of non-cancelled bookings with a check-in date in the selected period.',
  lead_time:
    'Average lead time = days between when a booking is made and its check-in date. Shorter lead time usually means last-minute demand.',
  cancellation_rate:
    'Cancellation rate = cancelled bookings ÷ all bookings with a check-in in the period.',
  rating: 'Average guest rating from submitted reviews for stays in the period.',
  repeat_guest_rate:
    'Repeat guest rate = share of bookings from a guest email that has booked this property before.',
  response_time:
    'Average first-response time = how quickly the host (or auto-reply) first replies to a new guest inbox conversation.',
  response_rate:
    '24-hour response rate = share of new guest conversations that got a first reply within 24 hours.',
  occupancy_on_books:
    'Occupancy on the books = nights already reserved in the forward window (default next 90 days) ÷ total nights in that window. Not the same as historical occupancy — this looks forward.',
  pickup:
    'Pickup = net new reservations made in the last 7 or 30 days for any future check-in date. A leading indicator of demand.',
  forward_occupancy_state:
    'A state label (underbooked / building / strong / fully_booked) computed from the next 30 and 60 days’ booked-nights ratio against this property’s own trailing 90-day baseline — not a fixed global threshold.',
  balance_collection_state:
    'A state label (clear / attention_needed / at_risk) from upcoming, non-cancelled bookings that still have an unpaid balance, weighted by how close check-in is.',
};

function normalizeMetricKey(raw: string): MetricKey | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
  return key in METRIC_EXPLANATIONS ? (key as MetricKey) : null;
}

/** explain_metric — deterministic glossary lookup, no DB access, no RBAC needed beyond base access. */
export function toolExplainAnalyticsMetric(args: Record<string, unknown>): AnalyticsToolResult {
  const raw = str(args, 'metric');
  const metric = raw ? normalizeMetricKey(raw) : null;
  if (!metric) {
    return {
      ok: false,
      error: `Unknown metric: ${raw ?? ''}. Known metrics: ${Object.keys(METRIC_EXPLANATIONS).join(', ')}`,
    };
  }
  return {
    ok: true,
    riskTier: 'tier0_read',
    data: { metric, explanation: METRIC_EXPLANATIONS[metric] },
  };
}

export const GET_PROPERTY_ANALYTICS_TOOL_DECLARATION = {
  name: 'get_property_analytics',
  description:
    'Get this property’s Analytics page numbers: occupancy/ADR/RevPAR/revenue KPIs vs prior period and year-over-year, the forward occupancy + balance-collection state assessment, next-90-day pace, channel mix, top guest origins, the "vs Kame median" platform benchmark (when enough peer listings exist), and matched Improvement Playbook articles. Requires the Analytics (Pro) plan feature.',
  parameters: {
    type: 'object',
    properties: {
      propertyId: { type: 'string' },
      period: { type: 'string', enum: ['last_30d', 'last_90d', 'this_month'] },
    },
    required: [],
  },
};

export const EXPLAIN_ANALYTICS_METRIC_TOOL_DECLARATION = {
  name: 'explain_metric',
  description:
    'Explain what an Analytics page metric means in plain language (occupancy, ADR, RevPAR, RevPAR, pickup, the state-assessment labels, etc.) — deterministic glossary, no property data.',
  parameters: {
    type: 'object',
    properties: {
      metric: {
        type: 'string',
        enum: [
          'occupancy',
          'adr',
          'revpar',
          'revenue',
          'net_profit',
          'reservations',
          'lead_time',
          'cancellation_rate',
          'rating',
          'repeat_guest_rate',
          'response_time',
          'response_rate',
          'occupancy_on_books',
          'pickup',
          'forward_occupancy_state',
          'balance_collection_state',
        ],
      },
    },
    required: ['metric'],
  },
};
