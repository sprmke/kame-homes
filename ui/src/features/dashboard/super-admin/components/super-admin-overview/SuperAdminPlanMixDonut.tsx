import { useMemo } from 'react';

import { PieChart as PieChartIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import type { SuperAdminOverview } from '@/features/dashboard/super-admin/hooks/useSuperAdminOverview';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';

const PALETTE = ['#0ea5e9', '#8b5cf6', '#14b8a6', '#f59e0b', '#f43f5e', '#64748b', '#f97316'];

export function SuperAdminPlanMixDonut({ planMix }: { planMix: SuperAdminOverview['planMix'] }) {
  const chartData = useMemo(() => planMix.filter((row) => row.count > 0), [planMix]);
  const total = useMemo(() => chartData.reduce((sum, row) => sum + row.count, 0), [chartData]);

  return (
    <section
      className="surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4"
      aria-label="Plan mix"
    >
      <AdminSurfaceCardHeader
        icon={PieChartIcon}
        title="Plan mix"
        description="Live subscriptions by plan"
        iconClassName="bg-muted/80"
      />
      <div className="flex min-h-[220px] flex-1 flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[200px] shrink-0">
          {chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={2.5}
                    dataKey="count"
                    nameKey="label"
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={entry.code} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold tabular-nums tracking-tight">{total}</p>
                <p className="text-muted-foreground text-xs font-medium">Subs</p>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              No live subscriptions
            </div>
          )}
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {chartData.map((row, index) => (
            <li key={row.code} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: PALETTE[index % PALETTE.length] }}
                  aria-hidden
                />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
