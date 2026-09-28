import { useState } from 'react';

import { Link } from 'react-router-dom';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AssistantEvalRunsCard } from '@/features/dashboard/super-admin/components/super-admin-ai/AssistantEvalRunsCard';
import {
  useSuperAdminAiUsage,
  type SuperAdminAiUsageRange,
} from '@/features/dashboard/super-admin/hooks/useSuperAdminAiUsage';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { StatCard } from '@/components/shared/StatCard';
import { SuperAdminOverviewBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { CHART_HEIGHT_CLASS, defaultChartMargin } from '@/lib/charts/chartStyles';

const PALETTE = ['#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#f43f5e', '#64748b', '#f97316'];

function labelFeature(feature: string): string {
  return feature.replace(/_/g, ' ');
}

function formatLatency(ms: number | null): string {
  if (ms == null) return '-';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

export function AiUsageTab() {
  const [range, setRange] = useState<SuperAdminAiUsageRange>('30d');
  const { data, isLoading, error } = useSuperAdminAiUsage(range);
  const isBelowMd = useIsBelowMd();

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          Spend trend, cost by feature, top organizations, and current quota breaches.
        </p>
        <SegmentedControl
          value={range}
          onChange={setRange}
          size="dense"
          equalSegments
          aria-label="Time range"
          options={[
            { value: '30d', label: '30d' },
            { value: '90d', label: '90d' },
            { value: '12mo', label: '12mo' },
          ]}
        />
      </div>
      {isLoading && !data ? (
        <SuperAdminOverviewBodySkeleton metricCount={4} />
      ) : error ? (
        <p className="text-destructive text-sm">Could not load AI usage.</p>
      ) : null}
      {data ? (
        <>
          <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5 lg:gap-4">
            <StatCard
              title="Spend"
              value={`$${data.totals.costUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
              iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
            />
            <StatCard
              title="Calls"
              value={data.totals.calls.toLocaleString('en-US')}
              iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
            />
            <StatCard
              title="Orgs using AI"
              value={String(data.totals.orgsWithUsage)}
              iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
            />
            <StatCard
              title="Quota breaches"
              value={String(data.totals.quotaBreaches)}
              iconBgClassName="bg-rose-100 dark:bg-rose-900/30"
            />
            <StatCard
              title="Projected this month"
              value={`$${data.totals.projectedMonthEndUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
              iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
            />
          </section>

          <div className="grid min-w-0 items-stretch gap-3 sm:gap-4 lg:grid-cols-2">
            <section className="surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4">
              <AdminSurfaceCardHeader title="Spend over time" description="Estimated USD per day" />
              <div className={CHART_HEIGHT_CLASS}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailySeries} margin={defaultChartMargin(isBelowMd)}>
                    <defs>
                      <linearGradient id="saAiSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 9 : 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => v.slice(5)}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v: number) => `$${Number(v).toFixed(2)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`$${Number(v).toFixed(4)}`, 'Cost']}
                    />
                    <Area
                      type="monotone"
                      dataKey="costUsd"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#saAiSpend)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4">
              <AdminSurfaceCardHeader
                title="Cost by feature"
                description="Estimated USD in range"
              />
              <div className={CHART_HEIGHT_CLASS}>
                {data.featureBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.featureBreakdown.slice(0, 10).map((r) => ({
                        ...r,
                        name: labelFeature(r.feature),
                      }))}
                      layout="vertical"
                      margin={{ ...defaultChartMargin(isBelowMd), left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: isBelowMd ? 10 : 12,
                        }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `$${Number(v).toFixed(2)}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={isBelowMd ? 92 : 130}
                        tick={{
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: isBelowMd ? 10 : 12,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [`$${Number(v).toFixed(4)}`, 'Cost']}
                      />
                      <Bar dataKey="costUsd" radius={[0, 4, 4, 0]}>
                        {data.featureBreakdown.slice(0, 10).map((entry, index) => (
                          <Cell key={entry.feature} fill={PALETTE[index % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    No AI usage in this range
                  </div>
                )}
              </div>
            </section>
          </div>

          {data.featureBreakdown.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-section-title">Feature health</h2>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        <TableHead>Calls</TableHead>
                        <TableHead>Errors</TableHead>
                        <TableHead>Fallback</TableHead>
                        <TableHead className="hidden md:table-cell">p50</TableHead>
                        <TableHead>p95</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.featureBreakdown.map((f) => (
                        <TableRow key={f.feature}>
                          <TableCell className="font-medium">{labelFeature(f.feature)}</TableCell>
                          <TableCell className="tabular-nums">{f.calls}</TableCell>
                          <TableCell className="tabular-nums">
                            {f.errors} ({f.errorRatePct}%)
                          </TableCell>
                          <TableCell className="tabular-nums">{f.fallbackRatePct}%</TableCell>
                          <TableCell className="hidden tabular-nums md:table-cell">
                            {formatLatency(f.latencyP50Ms)}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatLatency(f.latencyP95Ms)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-section-title">Top organizations by spend</h2>
            {data.topOrgs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No AI usage yet.</p>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Profile</TableHead>
                        <TableHead>Spend</TableHead>
                        <TableHead>Calls</TableHead>
                        <TableHead>Today / limit</TableHead>
                        <TableHead>Month / limit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topOrgs.map((o) => (
                        <TableRow key={o.organizationId}>
                          <TableCell>
                            {o.organizationSlug ? (
                              <Link
                                to={`${superAdminPaths.aiTab('limits')}&q=${encodeURIComponent(o.organizationName)}`}
                                className="font-medium hover:underline"
                              >
                                {o.organizationName}
                              </Link>
                            ) : (
                              <span className="font-medium">{o.organizationName}</span>
                            )}
                            {!o.aiEnabled ? (
                              <Badge variant="outline" className="ml-2">
                                AI off
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant={o.hasOverrides ? 'destructive' : 'secondary'}>
                              {o.hasOverrides ? 'Override' : (o.profileCode ?? 'default')}
                            </Badge>
                          </TableCell>
                          <TableCell className="tabular-nums">${o.costUsd.toFixed(4)}</TableCell>
                          <TableCell className="tabular-nums">{o.calls}</TableCell>
                          <TableCell
                            className={
                              o.overDaily
                                ? 'text-destructive font-medium tabular-nums'
                                : 'tabular-nums'
                            }
                          >
                            {o.todayCalls} / {o.dailyLimit}
                          </TableCell>
                          <TableCell
                            className={
                              o.overMonthly
                                ? 'text-destructive font-medium tabular-nums'
                                : 'tabular-nums'
                            }
                          >
                            {o.monthCalls} / {o.monthlyLimit}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>

          {data.assistantFeedback ? (
            <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="Assistant feedback">
              <AdminSurfaceCardHeader
                title="Assistant feedback"
                description={
                  data.assistantFeedback.positivePct == null
                    ? 'No ratings yet'
                    : `${data.assistantFeedback.positivePct}% helpful · ${data.assistantFeedback.up} up · ${data.assistantFeedback.down} down`
                }
              />
              {data.assistantFeedback.recentNegative.length > 0 ? (
                <ul className="divide-border/60 mt-2 divide-y text-sm">
                  {data.assistantFeedback.recentNegative.map((item) => (
                    <li
                      key={`${item.createdAt}-${item.orgName ?? ''}`}
                      className="flex min-w-0 items-center gap-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate" title={item.reason ?? undefined}>
                        {item.reason ?? 'No reason given'}
                      </span>
                      <span className="text-muted-foreground shrink-0 truncate text-xs">
                        {item.orgName ?? 'Unknown org'}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {new Date(item.createdAt).toLocaleDateString('en-PH', {
                          timeZone: 'Asia/Manila',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {data.assistantEvalRuns ? <AssistantEvalRunsCard runs={data.assistantEvalRuns} /> : null}
        </>
      ) : null}
    </div>
  );
}
