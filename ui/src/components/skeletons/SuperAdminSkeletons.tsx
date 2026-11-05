import { Building, Car, DollarSign, Users } from 'lucide-react';

import { StatCardSkeleton } from '@/components/shared/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ORG_HUB_SECTIONS = [
  'Overview',
  'Subscription',
  'Listings',
  'Approvals',
  'AI credits',
  'Support',
  'Activity',
  'Settings',
];

const ORG_OVERVIEW_METRICS = [
  { title: 'Properties', icon: Building },
  { title: 'Parkings', icon: Car },
  { title: 'Team members', icon: Users },
  { title: 'MRR', icon: DollarSign },
];

function SuperAdminToolbarSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center',
        compact ? 'sm:justify-end' : 'sm:justify-between'
      )}
      aria-hidden
    >
      {compact ? null : <Skeleton className="h-10 w-full rounded-lg sm:max-w-xs" />}
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <Skeleton className="h-10 w-24 rounded-lg" />
        {compact ? null : <Skeleton className="h-10 w-20 rounded-lg" />}
      </div>
    </div>
  );
}

/** Desktop table shape; hidden below `lg` because these lists switch to cards. */
function SuperAdminTableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="surface-card surface-card-clip overflow-hidden" aria-hidden>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="border-separator bg-card flex items-center gap-4 border-b px-4 py-3 sm:px-5">
            {[96, 64, 56, 72, 24].map((width, index) => (
              <Skeleton key={index} className="h-2.5 rounded-full" style={{ width }} />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className={cn(
                'bg-card flex items-center gap-4 px-4 py-3.5 sm:px-5',
                index > 0 && 'border-separator border-t'
              )}
              style={{ opacity: 1 - index * 0.08 }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40 max-w-full" />
                  <Skeleton className="h-2.5 w-28 max-w-full" />
                </div>
              </div>
              <Skeleton className="hidden h-3 w-16 md:block" />
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="hidden h-3 w-20 lg:block" />
              <Skeleton className="size-8 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuperAdminCardGridSkeleton({
  count,
  cols = 'wide',
}: {
  count: number;
  cols?: 'wide' | 'narrow';
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6',
        cols === 'wide' ? 'lg:grid-cols-3 xl:grid-cols-4' : 'lg:grid-cols-3'
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="border-border/50 bg-card flex min-h-[9.5rem] flex-col gap-2 rounded-xl border p-4 sm:p-5"
          style={{ opacity: 1 - index * 0.05 }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3 max-w-full" />
              <Skeleton className="h-3 w-1/2 max-w-full" />
            </div>
            <Skeleton className="size-9 shrink-0 rounded-lg" />
          </div>
          <Skeleton className="h-3 w-3/4" />
          <div className="mt-auto flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SuperAdminGroupedRowsSkeleton({
  groups = 3,
  rowsPerGroup = 3,
}: {
  groups?: number;
  rowsPerGroup?: number;
}) {
  return (
    <div className="space-y-5" aria-hidden>
      {Array.from({ length: groups }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-2">
          <Skeleton className="h-2.5 w-24" />
          {Array.from({ length: rowsPerGroup }).map((__, rowIndex) => (
            <div
              key={rowIndex}
              className="border-border/50 bg-card flex items-start gap-3 rounded-xl border p-4"
              style={{ opacity: 1 - rowIndex * 0.06 }}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Skeleton className="h-3.5 w-2/5 max-w-[18rem]" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full max-w-lg" />
              </div>
              <Skeleton className="size-8 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Super-admin list pages (hosts, approvals, developments, support, plans, subscriptions,
 * properties): summary cards, toolbar, then a responsive table (desktop) / card grid (phone).
 */
export function SuperAdminAdminListBodySkeleton({
  metricCount = 4,
  tableRows = 6,
  cardCount = 6,
  view = 'table',
  metricTitles,
}: {
  metricCount?: number;
  tableRows?: number;
  cardCount?: number;
  view?: 'table' | 'cards' | 'grouped';
  /** Fixed summary-card labels for this page. */
  metricTitles?: string[];
}) {
  const summaryTitles = metricTitles ?? [];
  const summaryCount = metricTitles ? metricTitles.length : metricCount;

  return (
    <div role="status" className="space-y-3 sm:space-y-4" aria-busy="true" aria-label="Loading">
      {summaryCount > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4" aria-hidden>
          {summaryTitles.length > 0
            ? summaryTitles.map((title, index) => (
                <StatCardSkeleton key={title} title={title} style={{ opacity: 1 - index * 0.05 }} />
              ))
            : Array.from({ length: summaryCount }).map((_, index) => (
                <StatCardSkeleton key={index} style={{ opacity: 1 - index * 0.05 }} />
              ))}
        </div>
      ) : null}

      <SuperAdminToolbarSkeleton compact={view === 'grouped'} />

      {view === 'grouped' ? (
        <SuperAdminGroupedRowsSkeleton />
      ) : view === 'cards' ? (
        <SuperAdminCardGridSkeleton count={cardCount} />
      ) : (
        <>
          <div className="hidden lg:block">
            <SuperAdminTableSkeleton rows={tableRows} />
          </div>
          <div className="lg:hidden">
            <SuperAdminCardGridSkeleton count={cardCount} />
          </div>
        </>
      )}

      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        aria-hidden
      >
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>
    </div>
  );
}

/** Overview: 12 KPI cards, growth + plan mix, AI cost + attention, then recent activity. */
const SUPER_ADMIN_OVERVIEW_TITLES = [
  'Organizations',
  'Live subscriptions',
  'Hosts',
  'Properties',
  'Developments',
  'Parkings',
  'Pending approvals',
  'Open tickets',
  'AI spend',
  'Undisbursed payouts',
  'Orgs without plan',
  'Trialing subs',
];

export function SuperAdminOverviewBodySkeleton({
  metricCount = 12,
  metricTitles = SUPER_ADMIN_OVERVIEW_TITLES,
}: { metricCount?: number; metricTitles?: string[] } = {}) {
  return (
    <div
      role="status"
      className="space-y-3 sm:space-y-4"
      aria-busy="true"
      aria-label="Loading overview"
    >
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-4 lg:gap-3" aria-hidden>
        {metricTitles.slice(0, metricCount).map((title, index) => (
          <StatCardSkeleton key={title} title={title} style={{ opacity: 1 - (index % 4) * 0.05 }} />
        ))}
      </div>

      <div className="grid min-w-0 items-stretch gap-3 sm:gap-4 lg:grid-cols-3" aria-hidden>
        <div className="surface-card p-3 sm:p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2.5">
            <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg lg:!size-10 lg:!rounded-xl" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
        <div className="surface-card flex flex-col p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg lg:!size-10 lg:!rounded-xl" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-1 items-center justify-center py-2">
            <Skeleton className="size-40 shrink-0 rounded-full sm:size-44" />
          </div>
        </div>
      </div>

      <div className="grid min-w-0 items-stretch gap-3 sm:gap-4 lg:grid-cols-3" aria-hidden>
        <div className="surface-card p-3 sm:p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2.5">
            <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg lg:!size-10 lg:!rounded-xl" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
        <div className="surface-card space-y-2 p-3 sm:p-4">
          <div className="mb-1 flex items-center gap-2.5">
            <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg lg:!size-10 lg:!rounded-xl" />
            <Skeleton className="h-4 w-28" />
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>

      <div className="surface-card p-3 sm:p-4" aria-hidden>
        <Skeleton className="mb-3 h-4 w-32" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Search + per-page + event card rows. */
export function SuperAdminAuditBodySkeleton() {
  return (
    <div role="status" className="space-y-3" aria-busy="true" aria-label="Loading audit log">
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        aria-hidden
      >
        <Skeleton className="h-10 w-full rounded-lg sm:max-w-xs" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <div className="space-y-2" aria-hidden>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="border-border/50 bg-card space-y-1.5 rounded-xl border p-4"
            style={{ opacity: 1 - index * 0.07 }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Skeleton className="h-3.5 w-2/5 max-w-[22rem]" />
              <Skeleton className="h-2.5 w-16 shrink-0" />
            </div>
            <Skeleton className="h-3 w-3/5 max-w-[26rem]" />
          </div>
        ))}
      </div>
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        aria-hidden
      >
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>
    </div>
  );
}

function SettingsCardSkeleton({ title, rows = 4 }: { title?: string; rows?: number }) {
  return (
    <div className="border-border/50 bg-card overflow-hidden rounded-xl border" aria-hidden>
      <div className="space-y-1.5 p-4 pb-2 sm:p-6 sm:pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded" />
          {title ? (
            <h2 className="text-base font-semibold">{title}</h2>
          ) : (
            <Skeleton className="h-4 w-32" />
          )}
        </div>
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
      <div className="space-y-3 p-4 pt-2 sm:p-6 sm:pt-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="border-border/40 flex min-h-[44px] flex-col gap-2 border-b pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/2 max-w-[14rem]" />
              <Skeleton className="h-2.5 w-3/4 max-w-[22rem]" />
            </div>
            <Skeleton className="h-9 w-full shrink-0 rounded-lg sm:w-40" />
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <Skeleton className="h-11 w-full rounded-lg sm:w-24" />
        </div>
      </div>
    </div>
  );
}

/** Settings pages: one or more `SuperAdminSettingsCard`s. */
export function SuperAdminSettingsBodySkeleton({
  cards = 2,
  titles,
}: {
  cards?: number;
  titles?: string[];
}) {
  return (
    <div
      role="status"
      className="space-y-3 sm:space-y-4"
      aria-busy="true"
      aria-label="Loading settings"
    >
      {Array.from({ length: cards }).map((_, index) => (
        <SettingsCardSkeleton key={index} title={titles?.[index]} rows={index === 0 ? 4 : 3} />
      ))}
    </div>
  );
}

/** Health overview: overall status card + category tiles + issues list. */
export function SuperAdminHealthBodySkeleton() {
  return (
    <div
      role="status"
      className="space-y-3 sm:space-y-4"
      aria-busy="true"
      aria-label="Loading health"
    >
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]" aria-hidden>
        <div className="surface-card min-w-0 p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <Skeleton className="icon-well-sm !size-8 shrink-0 !rounded-lg" />
            <h2 className="text-card-title">Overall</h2>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="size-32 shrink-0 rounded-full sm:size-40" />
            <div className="min-w-0 flex-1 space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="size-2.5 shrink-0 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {['Configuration', 'Security', 'Integrations', 'Scheduled jobs', 'Database'].map(
            (label, index) => (
              <div
                key={label}
                className="border-border/50 bg-card space-y-2 rounded-xl border p-3 sm:p-4"
                style={{ opacity: 1 - index * 0.05 }}
              >
                <h3 className="text-sm font-semibold">{label}</h3>
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            )
          )}
        </div>
      </div>
      <div className="surface-card p-3 sm:p-4" aria-hidden>
        <div className="mb-3 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Rate limits: enforcement banner, active counter section, manual block, blocked identities. */
export function SuperAdminCardListBodySkeleton() {
  return (
    <div role="status" className="space-y-4" aria-busy="true" aria-label="Loading">
      <div
        className="border-border/50 bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        aria-hidden
      >
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
      {['Active in the last hour', 'Manual block', 'Blocked identities'].map((title) => (
        <div key={title} className="space-y-2" aria-hidden>
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="border-border/50 bg-card space-y-3 rounded-xl border p-4">
            <Skeleton className="h-3 w-full max-w-xl" />
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg sm:w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Host detail: back link + identity header, 3 stat cards, filter row, listing grid. */
export function SuperAdminHostShellBodySkeleton() {
  return (
    <div
      role="status"
      className="space-y-3 sm:space-y-4"
      aria-busy="true"
      aria-label="Loading host"
    >
      <div className="space-y-2" aria-hidden>
        <span className="text-muted-foreground inline-flex h-6 items-center text-sm font-medium">
          ‹ Hosts
        </span>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-6 w-48 max-w-full" />
            <p className="text-muted-foreground text-sm">
              Organizations and properties owned by this host.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:gap-4" aria-hidden>
        {[
          { title: 'Organizations', icon: Users },
          { title: 'Properties', icon: Building },
          { title: 'Parking slots', icon: Car },
        ].map((metric, index) => (
          <StatCardSkeleton
            key={metric.title}
            title={metric.title}
            icon={metric.icon}
            style={{ opacity: 1 - index * 0.05 }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-hidden>
        <Skeleton className="h-10 w-full rounded-lg sm:max-w-xs" />
        <Skeleton className="h-10 w-40 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-20 rounded-lg" />
        </div>
      </div>
      <SuperAdminCardGridSkeleton count={6} cols="narrow" />
    </div>
  );
}

/** Org hub: header (back link, name, badge, open dashboard) + 8-section nav layout. */
export function SuperAdminOrgHubBodySkeleton() {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-busy="true"
      aria-label="Loading organization"
    >
      <div className="space-y-1.5 pb-3 sm:pb-4" aria-hidden>
        <span className="text-muted-foreground inline-flex h-6 items-center text-sm font-medium">
          ‹ Organizations
        </span>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <p className="text-muted-foreground text-sm">
          Manage this organization&apos;s plan, listings, and support.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:gap-8 xl:gap-10">
        <aside className="hidden w-56 shrink-0 lg:block lg:self-start" aria-hidden>
          <div className="border-border/50 bg-card space-y-1 rounded-xl border p-2">
            {ORG_HUB_SECTIONS.map((label) => (
              <div
                key={label}
                className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5"
              >
                <Skeleton className="size-4 shrink-0 rounded" />
                <span className="text-muted-foreground truncate text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <div className="space-y-3" aria-hidden>
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded" />
                <h2 className="text-section-title">Overview</h2>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
                {ORG_OVERVIEW_METRICS.map((metric, cardIndex) => (
                  <StatCardSkeleton
                    key={metric.title}
                    title={metric.title}
                    icon={metric.icon}
                    style={{ opacity: 1 - cardIndex * 0.05 }}
                  />
                ))}
              </div>
              <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                {['Verification', 'Open work'].map((title) => (
                  <div
                    key={title}
                    className="border-border/50 bg-card space-y-3 rounded-xl border p-4 sm:p-5"
                  >
                    <h3 className="text-base font-semibold">{title}</h3>
                    {Array.from({ length: 3 }).map((__, row) => (
                      <div key={row} className="flex items-center justify-between gap-3 py-1">
                        <Skeleton className="h-3 w-1/2 max-w-[8rem]" />
                        <Skeleton className="h-5 w-16 rounded-md" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {ORG_HUB_SECTIONS.slice(1).map((section) => (
              <div key={section} className="space-y-3" aria-hidden>
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <h2 className="text-section-title">{section}</h2>
                </div>
                <div className="border-border/50 bg-card space-y-3 rounded-xl border p-4 sm:p-5">
                  {Array.from({ length: 3 }).map((__, row) => (
                    <div
                      key={row}
                      className="border-border/40 flex min-h-[44px] items-center justify-between gap-3 border-b pb-3 last:border-0"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-2/5 max-w-[12rem]" />
                        <Skeleton className="h-2.5 w-3/5 max-w-[18rem]" />
                      </div>
                      <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
