import { useState } from 'react';

import { TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { SuperAdminOverviewGrowthPoint } from '@/features/dashboard/super-admin/hooks/useSuperAdminOverview';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import {
  SegmentedControl,
  cardHeaderSegmentedListClassName,
  cardHeaderSegmentedTriggerClassName,
} from '@/components/ui/sliding-tabs';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { CHART_HEIGHT_CLASS, defaultChartMargin } from '@/lib/charts/chartStyles';

type Mode = 'cumulative' | 'new';

const ORG_COLOR = '#14b8a6';
const SUB_COLOR = '#0ea5e9';

export function SuperAdminGrowthChart({ data }: { data: SuperAdminOverviewGrowthPoint[] }) {
  const [mode, setMode] = useState<Mode>('cumulative');
  const isBelowMd = useIsBelowMd();
  const orgKey = mode === 'cumulative' ? 'cumulativeOrgs' : 'newOrgs';
  const subKey = mode === 'cumulative' ? 'cumulativeSubscriptions' : 'newSubscriptions';

  return (
    <section className="surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4">
      <AdminSurfaceCardHeader
        icon={TrendingUp}
        title="Growth"
        description="Organizations & subscriptions over the last 12 months"
        iconClassName="bg-muted/80"
        action={
          <SegmentedControl
            value={mode}
            onChange={setMode}
            size="dense"
            equalSegments
            listClassName={cardHeaderSegmentedListClassName}
            triggerClassName={cardHeaderSegmentedTriggerClassName}
            aria-label="Growth mode"
            options={[
              { value: 'cumulative', label: 'Total' },
              { value: 'new', label: 'New' },
            ]}
          />
        }
      />
      <div className={`${CHART_HEIGHT_CLASS} min-h-0 flex-1`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={defaultChartMargin(isBelowMd)}>
            <defs>
              <linearGradient id="saOrgFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ORG_COLOR} stopOpacity={0.3} />
                <stop offset="95%" stopColor={ORG_COLOR} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="saSubFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SUB_COLOR} stopOpacity={0.3} />
                <stop offset="95%" stopColor={SUB_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey={orgKey}
              name="Organizations"
              stroke={ORG_COLOR}
              strokeWidth={2}
              fill="url(#saOrgFill)"
            />
            <Area
              type="monotone"
              dataKey={subKey}
              name="Subscriptions"
              stroke={SUB_COLOR}
              strokeWidth={2}
              fill="url(#saSubFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
