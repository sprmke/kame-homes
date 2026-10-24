/**
 * Permission-gated briefing extras (inbox, maintenance, holidays, channel sync,
 * verification, AI quota, reviews) plus a deterministic "Since yesterday" delta.
 * Booking-pipeline cards stay in computeDashboardStats so the dashboard cache is unchanged.
 */

import { manilaTodayIso } from './bookingsListSort.ts';
import {
  createServiceClient,
  verifyOrgAccess,
  verifyParkingTeamAccess,
  verifyPropertyAccess,
} from './orgAuth.ts';
import { readOrgVerificationFromSettings } from './orgVerification.ts';
import type { DashboardAssistantOrgSettings } from './dashboardAssistantSettings.ts';
import type { DashboardAttentionItem, DashboardAttentionSeverity } from './dashboardService.ts';
import type { DashboardStatsScope } from './dashboardStatsScope.ts';

export const LOW_OCCUPANCY_PCT = 50;
export const AI_QUOTA_WARN_PCT = 80;
export const HOLIDAY_WINDOW_DAYS = 60;
export const OCCUPANCY_WINDOW_DAYS = 30;
export const VERIFICATION_WINDOW_DAYS = 30;
export const BRIEFING_SHEET_CARD_MAX = 3;

export type BriefingDelta = {
  newBookings: number;
  newMessages: number;
  completedStays: number;
};

export type HolidayRuleRange = {
  startDate: string;
  endDate: string;
};

/** Philippine holidays used when a listing has no covering rate rule (2026 calendar). */
export const PH_PRICING_HOLIDAYS: Array<{
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}> = [
  { id: 'new-year', name: "New Year's Day", startDate: '2026-01-01', endDate: '2026-01-01' },
  {
    id: 'chinese-new-year',
    name: 'Chinese New Year',
    startDate: '2026-02-17',
    endDate: '2026-02-17',
  },
  { id: 'holy-week', name: 'Holy Week', startDate: '2026-04-02', endDate: '2026-04-05' },
  { id: 'labor-day', name: 'Labor Day', startDate: '2026-05-01', endDate: '2026-05-01' },
  { id: 'independence', name: 'Independence Day', startDate: '2026-06-12', endDate: '2026-06-12' },
  { id: 'peak-july', name: 'Peak season', startDate: '2026-07-04', endDate: '2026-07-04' },
  { id: 'all-saints', name: "All Saints' Day", startDate: '2026-11-01', endDate: '2026-11-02' },
  { id: 'christmas', name: 'Christmas Season', startDate: '2026-12-24', endDate: '2026-12-26' },
  { id: 'new-year-eve', name: "New Year's Eve", startDate: '2026-12-31', endDate: '2026-12-31' },
];

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function holidaysInWindow(
  today: string,
  windowDays: number = HOLIDAY_WINDOW_DAYS
): typeof PH_PRICING_HOLIDAYS {
  const until = addDaysYmd(today, windowDays);
  const year = Number(today.slice(0, 4));
  const shifted = PH_PRICING_HOLIDAYS.flatMap((holiday) => {
    const years = [year, year + 1];
    return years.map((y) => ({
      ...holiday,
      id: `${holiday.id}-${y}`,
      startDate: `${y}-${holiday.startDate.slice(5)}`,
      endDate: `${y}-${holiday.endDate.slice(5)}`,
    }));
  });
  return shifted.filter((holiday) =>
    rangesOverlap(holiday.startDate, holiday.endDate, today, until)
  );
}

export function unpricedHolidayNames(
  upcoming: typeof PH_PRICING_HOLIDAYS,
  rules: HolidayRuleRange[]
): string[] {
  return upcoming
    .filter(
      (holiday) =>
        !rules.some((rule) =>
          rangesOverlap(holiday.startDate, holiday.endDate, rule.startDate, rule.endDate)
        )
    )
    .map((holiday) => holiday.name);
}

export function overnightNightsInWindow(
  stays: Array<{ checkIn: string; checkOut: string }>,
  windowStart: string,
  windowEndExclusive: string
): number {
  let nights = 0;
  for (const stay of stays) {
    const start = stay.checkIn > windowStart ? stay.checkIn : windowStart;
    const end = stay.checkOut < windowEndExclusive ? stay.checkOut : windowEndExclusive;
    if (start >= end) continue;
    const a = Date.parse(`${start}T12:00:00Z`);
    const b = Date.parse(`${end}T12:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    nights += Math.max(0, Math.round((b - a) / 86_400_000));
  }
  return nights;
}

export function forwardOccupancyPercent(
  stays: Array<{ checkIn: string; checkOut: string }>,
  today: string,
  unitCount: number,
  windowDays: number = OCCUPANCY_WINDOW_DAYS
): number | null {
  if (unitCount < 1) return null;
  const capacity = windowDays * unitCount;
  if (capacity < 1) return null;
  const occupied = overnightNightsInWindow(stays, today, addDaysYmd(today, windowDays));
  return Math.round((occupied / capacity) * 100);
}

function item(
  id: string,
  label: string,
  count: number,
  href: string,
  severity: DashboardAttentionSeverity
): DashboardAttentionItem {
  return { id, label, count, href, severity };
}

async function deniedAccess(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return false;
  } catch (err) {
    return err instanceof Response;
  }
}

export async function resolveBriefingLeaves(
  req: Request,
  scope: DashboardStatsScope
): Promise<{
  inbox: boolean;
  maintenance: boolean;
  pricing: boolean;
  channels: boolean;
  reviews: boolean;
  orgAdmin: boolean;
}> {
  if (scope.propertyId) {
    const propertyId = scope.propertyId;
    const [inbox, maintenance, pricing, channels, reviews] = await Promise.all([
      deniedAccess(() => verifyPropertyAccess(req, propertyId, 'inbox:view')).then((d) => !d),
      deniedAccess(() => verifyPropertyAccess(req, propertyId, 'maintenance:view')).then((d) => !d),
      deniedAccess(() => verifyPropertyAccess(req, propertyId, 'pricing:view')).then((d) => !d),
      deniedAccess(() => verifyPropertyAccess(req, propertyId, 'pricing.channels:view')).then(
        (d) => !d
      ),
      deniedAccess(() => verifyPropertyAccess(req, propertyId, 'reviews:view')).then((d) => !d),
    ]);
    return {
      inbox,
      maintenance,
      pricing,
      channels,
      reviews,
      orgAdmin: false,
    };
  }
  if (scope.parkingId) {
    const parkingId = scope.parkingId;
    const inbox = !(await deniedAccess(() =>
      verifyParkingTeamAccess(req, parkingId, 'inbox:view')
    ));
    return {
      inbox,
      maintenance: false,
      pricing: false,
      channels: false,
      reviews: false,
      orgAdmin: false,
    };
  }
  const org = await verifyOrgAccess(req, { orgId: scope.organizationId });
  const orgAdmin =
    org.accessKind === 'owner' ||
    org.accessKind === 'org_admin' ||
    org.accessKind === 'platform_admin';
  return {
    inbox: true,
    maintenance: true,
    pricing: true,
    channels: orgAdmin,
    reviews: true,
    orgAdmin,
  };
}

function listingFilter(scope: DashboardStatsScope): {
  propertyIds: string[] | null;
  parkingIds: string[] | null;
} {
  if (scope.propertyId) return { propertyIds: [scope.propertyId], parkingIds: [] };
  if (scope.parkingId) return { propertyIds: [], parkingIds: [scope.parkingId] };
  return {
    propertyIds: scope.scopedPropertyIds ?? null,
    parkingIds: scope.scopedParkingIds ?? null,
  };
}

async function countExact(
  build: () => PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  try {
    const { count, error } = await build();
    if (error) {
      console.warn('[briefingExtras] count failed:', error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn('[briefingExtras] count failed:', err);
    return 0;
  }
}

export async function loadExtendedAttentionItems(input: {
  req: Request;
  scope: DashboardStatsScope;
  orgSettings: DashboardAssistantOrgSettings;
  today?: string;
}): Promise<DashboardAttentionItem[]> {
  const today = input.today ?? manilaTodayIso();
  const leaves = await resolveBriefingLeaves(input.req, input.scope);
  const { propertyIds, parkingIds } = listingFilter(input.scope);
  const supabase = createServiceClient();
  const items: DashboardAttentionItem[] = [];
  const verifyUntil = addDaysYmd(today, VERIFICATION_WINDOW_DAYS);

  const tasks: Array<Promise<void>> = [];

  if (leaves.inbox) {
    tasks.push(
      (async () => {
        let q = supabase
          .from('social_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', input.scope.organizationId)
          .eq('reply_status', 'pending');
        if (input.scope.propertyId) q = q.eq('property_id', input.scope.propertyId);
        else if (input.scope.parkingId) q = q.eq('parking_id', input.scope.parkingId);
        else if (propertyIds && parkingIds) {
          if (propertyIds.length === 0 && parkingIds.length === 0) return;
          const clauses: string[] = [];
          if (propertyIds.length > 0) clauses.push(`property_id.in.(${propertyIds.join(',')})`);
          if (parkingIds.length > 0) clauses.push(`parking_id.in.(${parkingIds.join(',')})`);
          if (clauses.length > 0) q = q.or(clauses.join(','));
        }
        const count = await countExact(() => q);
        if (count > 0) {
          items.push(
            item(
              'inbox-pending',
              'Threads awaiting reply',
              count,
              '/inbox?tab=needs-reply',
              'critical'
            )
          );
        }
      })()
    );
  }

  if (
    leaves.maintenance &&
    propertyIds !== null &&
    propertyIds.length === 0 &&
    !input.scope.orgId
  ) {
    /* parking-only: skip */
  } else if (leaves.maintenance) {
    tasks.push(
      (async () => {
        let q = supabase
          .from('maintenance_items')
          .select('id', { count: 'exact', head: true })
          .is('completed_at', null)
          .lt('scheduled_on', today);
        if (input.scope.propertyId) q = q.eq('property_id', input.scope.propertyId);
        else if (propertyIds && propertyIds.length > 0) q = q.in('property_id', propertyIds);
        else if (input.scope.orgId) {
          /* org: filter via properties in org — maintenance_items is property-scoped */
          const { data: props } = await supabase
            .from('properties')
            .select('id')
            .eq('organization_id', input.scope.organizationId)
            .limit(200);
          const ids = (props ?? []).map((row) => String(row.id));
          const scoped = propertyIds ?? ids;
          if (scoped.length === 0) return;
          q = q.in('property_id', scoped);
        } else {
          return;
        }
        const count = await countExact(() => q);
        if (count > 0) {
          items.push(
            item('maintenance-overdue', 'Overdue maintenance', count, '/maintenance', 'warning')
          );
        }
      })()
    );
  }

  if (leaves.pricing && (input.scope.propertyId || input.scope.orgId)) {
    tasks.push(
      (async () => {
        const ids =
          input.scope.propertyId != null
            ? [input.scope.propertyId]
            : (propertyIds ??
              (
                await supabase
                  .from('properties')
                  .select('id')
                  .eq('organization_id', input.scope.organizationId)
                  .limit(200)
              ).data?.map((row) => String(row.id)) ??
              []);
        if (ids.length === 0) return;
        const { data, error } = await supabase
          .from('app_settings')
          .select('property_id, pricing_holiday_rules')
          .in('property_id', ids)
          .limit(ids.length);
        if (error) {
          console.warn('[briefingExtras] holiday rules:', error.message);
          return;
        }
        const upcoming = holidaysInWindow(today, HOLIDAY_WINDOW_DAYS);
        const uncovered = new Set<string>();
        for (const row of data ?? []) {
          const raw = row.pricing_holiday_rules;
          const rules: HolidayRuleRange[] = Array.isArray(raw)
            ? raw
                .map((rule) => {
                  if (!rule || typeof rule !== 'object') return null;
                  const startDate = String((rule as { startDate?: unknown }).startDate ?? '');
                  const endDate = String((rule as { endDate?: unknown }).endDate ?? '');
                  if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
                  ) {
                    return null;
                  }
                  return { startDate, endDate };
                })
                .filter((rule): rule is HolidayRuleRange => Boolean(rule))
            : [];
          for (const name of unpricedHolidayNames(upcoming, rules)) uncovered.add(name);
        }
        if (uncovered.size > 0) {
          items.push(
            item('unpriced-holidays', 'Unpriced holidays', uncovered.size, '/pricing', 'warning')
          );
        }
      })()
    );
  }

  if (leaves.channels && (input.scope.propertyId || input.scope.orgId)) {
    tasks.push(
      (async () => {
        let q = supabase
          .from('property_calendar_feeds')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .gt('consecutive_failures', 0);
        if (input.scope.propertyId) q = q.eq('property_id', input.scope.propertyId);
        else if (propertyIds && propertyIds.length > 0) q = q.in('property_id', propertyIds);
        else if (input.scope.orgId) {
          const { data: props } = await supabase
            .from('properties')
            .select('id')
            .eq('organization_id', input.scope.organizationId)
            .limit(200);
          const ids = (props ?? []).map((row) => String(row.id));
          if (ids.length === 0) return;
          q = q.in('property_id', ids);
        } else {
          return;
        }
        const count = await countExact(() => q);
        if (count > 0) {
          items.push(
            item('channel-sync-failed', 'Channel sync failed', count, '/settings', 'critical')
          );
        }
      })()
    );
  }

  if (leaves.reviews && (input.scope.propertyId || input.scope.orgId)) {
    tasks.push(
      (async () => {
        let q = supabase
          .from('guest_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published')
          .is('response_at', null);
        if (input.scope.propertyId) q = q.eq('property_id', input.scope.propertyId);
        else q = q.eq('organization_id', input.scope.organizationId);
        const count = await countExact(() => q);
        if (count > 0) {
          items.push(
            item('reviews-to-respond', 'Reviews to respond to', count, '/reviews', 'info')
          );
        }
      })()
    );
  }

  if (leaves.orgAdmin) {
    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', input.scope.organizationId)
          .maybeSingle();
        if (error) {
          console.warn('[briefingExtras] org settings:', error.message);
          return;
        }
        const verification = readOrgVerificationFromSettings(
          (data?.settings ?? {}) as Record<string, unknown>
        );
        const ends = [
          verification.propertyContractEndDate,
          verification.parkingContractEndDate,
        ].filter(
          (value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        );
        const expiring = ends.filter((value) => value >= today && value <= verifyUntil).length;
        if (expiring > 0) {
          items.push(
            item('verification-expiring', 'Verification expiring', expiring, '/settings', 'warning')
          );
        }
      })()
    );
  }

  tasks.push(
    (async () => {
      const monthStart = `${today.slice(0, 7)}-01`;
      const { data, error } = await supabase
        .from('ai_dashboard_assistant_usage_daily')
        .select('message_count')
        .eq('organization_id', input.scope.organizationId)
        .gte('usage_date', monthStart)
        .lte('usage_date', today)
        .limit(62);
      if (error) {
        console.warn('[briefingExtras] AI usage:', error.message);
        return;
      }
      const used = (data ?? []).reduce((sum, row) => sum + Number(row.message_count ?? 0), 0);
      const limit = input.orgSettings.monthlyMessageLimit;
      if (limit > 0 && used >= Math.ceil((AI_QUOTA_WARN_PCT / 100) * limit)) {
        const pct = Math.min(100, Math.round((used / limit) * 100));
        items.push(item('ai-quota', 'AI quota nearly spent', pct, '/settings', 'warning'));
      }
    })()
  );

  await Promise.all(tasks);
  return items;
}

export async function loadBriefingDelta(input: {
  scope: DashboardStatsScope;
}): Promise<BriefingDelta> {
  const today = manilaTodayIso();
  const yesterday = addDaysYmd(today, -1);
  const sinceIso = `${yesterday}T00:00:00+08:00`;
  const supabase = createServiceClient();

  const bookingQuery = () => {
    let q = supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', input.scope.organizationId)
      .eq('action', 'booking.created')
      .gte('created_at', sinceIso);
    if (input.scope.propertyId) q = q.eq('property_id', input.scope.propertyId);
    if (input.scope.parkingId) q = q.eq('parking_id', input.scope.parkingId);
    return q;
  };
  const completedQuery = () => {
    let q = supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', input.scope.organizationId)
      .eq('action', 'booking.status_changed')
      .contains('metadata', { to_status: 'COMPLETED' })
      .gte('created_at', sinceIso);
    if (input.scope.propertyId) q = q.eq('property_id', input.scope.propertyId);
    if (input.scope.parkingId) q = q.eq('parking_id', input.scope.parkingId);
    return q;
  };
  const messageQuery = () => {
    let q = supabase
      .from('social_messages')
      .select(
        'id, conversation:social_conversations!inner(organization_id, property_id, parking_id)',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq('direction', 'inbound')
      .gte('sent_at', sinceIso)
      .eq('conversation.organization_id', input.scope.organizationId);
    if (input.scope.propertyId) q = q.eq('conversation.property_id', input.scope.propertyId);
    if (input.scope.parkingId) q = q.eq('conversation.parking_id', input.scope.parkingId);
    return q;
  };

  const [newBookings, completedStays, newMessages] = await Promise.all([
    countExact(bookingQuery),
    countExact(completedQuery),
    countExact(messageQuery),
  ]);
  return { newBookings, newMessages, completedStays };
}

export function briefingDeltaHasSignal(delta: BriefingDelta): boolean {
  return delta.newBookings > 0 || delta.newMessages > 0 || delta.completedStays > 0;
}
