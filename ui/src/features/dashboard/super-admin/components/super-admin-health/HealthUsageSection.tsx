import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { ChevronRight, Database, Gauge, HardDrive, Sparkles } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { HealthStatusBadge } from '@/features/dashboard/super-admin/components/super-admin-health/HealthStatusBadge';
import { useSuperAdminAiUsage } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiUsage';
import { useSuperAdminRateLimits } from '@/features/dashboard/super-admin/hooks/useSuperAdminRateLimits';
import { useSystemHealthCapacity } from '@/features/dashboard/super-admin/hooks/useSystemHealth';
import { labelAiFeature } from '@/features/dashboard/super-admin/lib/aiFeatureLabels';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import {
  formatBytes,
  type HealthStatus,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { CHART_INFO_COLOR } from '@/lib/charts/chartStyles';

/** Mirror of `DB_SIZE_REFERENCE_BYTES` in `_shared/systemHealth/snapshotChecks.ts`. */
const DB_SIZE_REFERENCE_BYTES = 8 * 1024 ** 3;
/** Supabase Pro included file storage. Change if the plan changes. */
const STORAGE_REFERENCE_BYTES = 100 * 1024 ** 3;

function capacityStatus(pct: number): HealthStatus {
  return pct >= 0.95 ? 'error' : pct >= 0.8 ? 'warn' : 'ok';
}

function CapacityBar({ used, total }: { used: number; total: number }) {
  const pct = used / total;
  const status = capacityStatus(pct);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs tabular-nums">
        <span className="font-medium">{formatBytes(used)}</span>
        <span className="text-muted-foreground">of {formatBytes(total)}</span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
        <div
          className={
            status === 'ok'
              ? 'h-full bg-teal-500'
              : status === 'warn'
                ? 'h-full bg-amber-500'
                : 'h-full bg-rose-500'
          }
          style={{ width: `${Math.min(100, Math.max(pct * 100, 1))}%` }}
        />
      </div>
    </div>
  );
}

const usd = (value: number) => `$${value.toFixed(2)}`;

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CardLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-primary inline-flex min-h-[44px] items-center gap-0.5 text-xs font-medium"
    >
      {label}
      <ChevronRight className="size-3.5" aria-hidden />
    </Link>
  );
}

function BarRow({
  label,
  value,
  max,
  meta,
  mono = true,
}: {
  label: string;
  value: number;
  max: number;
  meta: string;
  mono?: boolean;
}) {
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={mono ? 'min-w-0 truncate font-mono' : 'min-w-0 truncate'}>{label}</span>
        <span className="text-muted-foreground shrink-0 tabular-nums">{meta}</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
        <div
          className="bg-primary/70 h-full rounded-full"
          style={{ width: `${max > 0 ? Math.max((value / max) * 100, 1) : 0}%` }}
        />
      </div>
    </li>
  );
}

function AiSpendCard() {
  const { data, isLoading } = useSuperAdminAiUsage('30d');
  const totals = data?.totals;
  return (
    <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="AI spend">
      <AdminSurfaceCardHeader
        icon={Sparkles}
        title="AI spend"
        iconClassName="bg-muted/80"
        action={<CardLink to={superAdminPaths.aiTab('usage')} label="Details" />}
      />
      {isLoading || !totals ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Month to date" value={usd(totals.monthToDateUsd)} />
            <Stat label="Projected" value={usd(totals.projectedMonthEndUsd)} />
            <Stat
              label="Daily cap"
              value={totals.platformDailyCapUsd > 0 ? usd(totals.platformDailyCapUsd) : 'None'}
            />
            <Stat label="Quota breaches" value={totals.quotaBreaches} />
          </div>
          <div className="h-24 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailySeries} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" hide />
                <Tooltip
                  formatter={(value: number) => [usd(value), 'Cost']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="costUsd"
                  stroke={CHART_INFO_COLOR}
                  fill={CHART_INFO_COLOR}
                  fillOpacity={0.15}
                  strokeWidth={1.75}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

const AI_FEATURE_LIMIT = 6;

function AiFeaturesCard() {
  const { data, isLoading } = useSuperAdminAiUsage('30d');
  const rows = [...(data?.featureBreakdown ?? [])]
    .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls)
    .slice(0, AI_FEATURE_LIMIT);
  const maxCost = Math.max(0, ...rows.map((row) => row.costUsd));
  return (
    <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="AI by feature">
      <AdminSurfaceCardHeader
        icon={Sparkles}
        title="AI by feature (30d)"
        iconClassName="bg-muted/80"
        action={<CardLink to={superAdminPaths.aiTab('usage')} label="All" />}
      />
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No AI calls</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <BarRow
              key={row.feature}
              label={labelAiFeature(row.feature)}
              value={row.costUsd}
              max={maxCost}
              mono={false}
              meta={`${usd(row.costUsd)} · ${row.calls.toLocaleString()} calls${
                row.errors ? ` · ${row.errorRatePct.toFixed(0)}% errors` : ''
              }`}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RateLimitsCard() {
  const { data, isLoading } = useSuperAdminRateLimits();
  const overLimit = data?.activeCounters.filter((c) => c.overLimit).length ?? 0;
  const status: HealthStatus = !data ? 'unknown' : overLimit > 0 ? 'warn' : 'ok';
  return (
    <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="Rate limits">
      <AdminSurfaceCardHeader
        icon={Gauge}
        title="Rate limits"
        iconClassName="bg-muted/80"
        action={<CardLink to={superAdminPaths.rateLimits} label="Details" />}
      />
      {isLoading || !data ? (
        <Skeleton className="h-14 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Mode" value={data.enforceEnabled ? 'Enforcing' : 'Log only'} />
          <Stat label="Limit" value={`${data.limit}/min`} />
          <Stat
            label="Over limit now"
            value={<HealthStatusBadge status={status} label={String(overLimit)} />}
          />
          <Stat label="Blocked" value={data.blocks.length} />
        </div>
      )}
    </section>
  );
}

function CapacityCard() {
  const { data, isLoading, error } = useSystemHealthCapacity();
  const status = capacityStatus(data ? data.db_size_bytes / DB_SIZE_REFERENCE_BYTES : 0);
  const maxTable = Math.max(0, ...(data?.tables.map((t) => t.bytes) ?? []));
  const maxBucket = Math.max(0, ...(data?.buckets?.map((b) => b.bytes) ?? []));
  const storageBytes = (data?.buckets ?? []).reduce((sum, b) => sum + b.bytes, 0);
  const storageStatus = capacityStatus(storageBytes / STORAGE_REFERENCE_BYTES);

  return (
    <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
      <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="Database">
        <AdminSurfaceCardHeader
          icon={Database}
          title="Database"
          iconClassName="bg-muted/80"
          action={data ? <HealthStatusBadge status={status} /> : null}
        />
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : error || !data ? (
          <p className="text-destructive text-sm">Could not load capacity</p>
        ) : (
          <div className="space-y-3">
            <CapacityBar used={data.db_size_bytes} total={DB_SIZE_REFERENCE_BYTES} />
            <ul className="space-y-2">
              {data.tables.map((table) => (
                <BarRow
                  key={table.name}
                  label={table.name}
                  value={table.bytes}
                  max={maxTable}
                  meta={`${formatBytes(table.bytes)} · ${table.approx_rows.toLocaleString()} rows`}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="Storage">
        <AdminSurfaceCardHeader
          icon={HardDrive}
          title="Storage"
          iconClassName="bg-muted/80"
          action={data?.buckets ? <HealthStatusBadge status={storageStatus} /> : null}
        />
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !data?.buckets ? (
          <p className="text-muted-foreground text-sm">Not available</p>
        ) : data.buckets.length === 0 ? (
          <p className="text-muted-foreground text-sm">No files</p>
        ) : (
          <div className="space-y-3">
            <CapacityBar used={storageBytes} total={STORAGE_REFERENCE_BYTES} />
            <ul className="space-y-2">
              {data.buckets.map((bucket) => (
                <BarRow
                  key={bucket.bucket}
                  label={bucket.bucket}
                  value={bucket.bytes}
                  max={maxBucket}
                  meta={`${formatBytes(bucket.bytes)} · ${bucket.objects.toLocaleString()} files`}
                />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

export function HealthUsageSection() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <AiSpendCard />
        <AiFeaturesCard />
      </div>
      <RateLimitsCard />
      <CapacityCard />
    </div>
  );
}
