import { useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { ChevronRight, ExternalLink, RefreshCw, Search } from 'lucide-react';

import {
  HealthStatusBadge,
  HealthStatusDot,
} from '@/features/dashboard/super-admin/components/super-admin-health/HealthStatusBadge';
import {
  countByStatus,
  formatAgo,
  groupChecks,
  healthCheckAnchor,
  isIssue,
  matchesFilter,
  type HealthCheck,
  type HealthStatusFilter,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';

import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

export type ProbeRunner = { run: (probeId: string) => void; pending: boolean };

const ENV_KEY = /^[A-Z][A-Z0-9_]+( or [A-Z0-9_]+)*$/;

const actionClass =
  'text-primary inline-flex min-h-[44px] items-center gap-1 text-xs font-medium hover:underline lg:min-h-7';

export function HealthCheckRow({
  check,
  showGroup = false,
  probes,
}: {
  check: HealthCheck;
  showGroup?: boolean;
  probes?: ProbeRunner;
}) {
  const isEnvKey = ENV_KEY.test(check.label);
  const issue = isIssue(check.status);
  const label = (
    <span
      className={cn('min-w-0 break-all text-sm font-medium', isEnvKey && 'font-mono text-[13px]')}
    >
      {check.label}
    </span>
  );

  return (
    <div
      id={healthCheckAnchor(check.id)}
      className="flex min-h-[44px] scroll-mt-28 items-start gap-2.5 px-3 py-2.5 transition-colors data-[highlight=true]:bg-amber-50 dark:data-[highlight=true]:bg-amber-950/30"
    >
      <HealthStatusDot status={check.status} className="mt-1.5" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {showGroup ? (
            <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
              {check.group}
            </span>
          ) : null}
          {check.fixHref ? (
            <Link to={check.fixHref} className="min-w-0 hover:underline">
              {label}
            </Link>
          ) : (
            label
          )}
          {check.detail ? (
            <span className="text-muted-foreground min-w-0 break-words text-xs">
              {check.detail}
            </span>
          ) : null}
        </div>
        {check.hint ? (
          <p
            className={cn(
              'text-xs',
              check.status === 'error'
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-amber-800 dark:text-amber-200'
            )}
          >
            {check.hint}
          </p>
        ) : null}
        {check.items?.length ? (
          <ul className="bg-muted/40 mt-1 divide-y rounded-md text-xs">
            {check.items.map((item) => (
              <li key={`${item.label}-${item.detail ?? ''}`}>
                {item.href ? (
                  <Link
                    to={item.href}
                    className="hover:bg-muted flex min-h-[44px] items-center justify-between gap-2 px-2 py-1.5 lg:min-h-8"
                  >
                    <ItemText label={item.label} detail={item.detail} />
                    <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                  </Link>
                ) : (
                  <div className="px-2 py-1.5">
                    <ItemText label={item.label} detail={item.detail} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {check.features?.length || check.checkedAt ? (
          <p className="text-muted-foreground text-[11px]">
            {check.features?.join(', ')}
            {check.features?.length && check.checkedAt ? ' · ' : null}
            {check.checkedAt ? `Checked ${formatAgo(check.checkedAt)}` : null}
          </p>
        ) : null}
        {(check.manageHref && issue) || (check.probeId && probes && check.status !== 'off') ? (
          <div className="flex flex-wrap items-center gap-x-4">
            {check.manageHref && issue ? (
              <a href={check.manageHref} target="_blank" rel="noreferrer" className={actionClass}>
                <ExternalLink className="size-3.5" aria-hidden />
                Manage
              </a>
            ) : null}
            {check.probeId && probes && check.status !== 'off' ? (
              <button
                type="button"
                className={cn(actionClass, 'disabled:opacity-50')}
                onClick={() => probes.run(check.probeId!)}
                disabled={probes.pending}
              >
                <RefreshCw
                  className={cn('size-3.5', probes.pending && 'animate-spin')}
                  aria-hidden
                />
                Check now
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {check.fixHref ? (
        <Link
          to={check.fixHref}
          aria-label={`Open ${check.label}`}
          className="text-muted-foreground -my-2.5 -mr-3 flex min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function ItemText({ label, detail }: { label: string; detail?: string }) {
  return (
    <span className="min-w-0">
      <span className="font-medium">{label}</span>
      {detail ? <span className="text-muted-foreground block break-words">{detail}</span> : null}
    </span>
  );
}

const FILTERS: Array<{ value: HealthStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'issues', label: 'Issues' },
  { value: 'ok', label: 'Healthy' },
  { value: 'off', label: 'Off' },
];

function matchesQuery(check: HealthCheck, query: string): boolean {
  if (!query) return true;
  const haystack = [check.label, check.group, check.detail, ...(check.features ?? [])]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/** Grouped check cards with a status filter and optional search. Groups and rows sort worst first. */
export function HealthCheckList({
  checks,
  emptyLabel = 'Nothing to show',
  showFilter = true,
  searchable = false,
  probes,
}: {
  checks: HealthCheck[];
  emptyLabel?: string;
  showFilter?: boolean;
  searchable?: boolean;
  probes?: ProbeRunner;
}) {
  const [filter, setFilter] = useState<HealthStatusFilter>('all');
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const searched = useMemo(
    () => checks.filter((check) => matchesQuery(check, normalized)),
    [checks, normalized]
  );
  const counts = useMemo(() => countByStatus(searched), [searched]);
  const groups = useMemo(
    () => groupChecks(searched.filter((check) => matchesFilter(check.status, filter))),
    [searched, filter]
  );

  return (
    <div className="space-y-3">
      {showFilter || searchable ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {showFilter ? (
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              size="dense"
              aria-label="Filter by status"
              options={FILTERS.map((item) => ({
                value: item.value,
                label: `${item.label} ${
                  item.value === 'all'
                    ? searched.length
                    : item.value === 'issues'
                      ? counts.error + counts.warn
                      : counts[item.value as 'ok' | 'off']
                }`,
              }))}
            />
          ) : null}
          {searchable ? (
            <div className="relative sm:w-64">
              <Search
                className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search keys or features"
                aria-label="Search checks"
                className="h-11 pl-8 lg:h-9"
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {groups.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{emptyLabel}</p>
      ) : (
        <div className="gap-3 xl:columns-2">
          {groups.map((group) => (
            <section
              key={group.group}
              className="surface-card mb-3 min-w-0 break-inside-avoid overflow-hidden"
              aria-label={group.group}
            >
              <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <h3 className="text-card-title">{group.group}</h3>
                <HealthStatusBadge status={group.status} />
              </header>
              <div className="divide-border/60 divide-y">
                {group.checks.map((check) => (
                  <HealthCheckRow key={check.id} check={check} probes={probes} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
