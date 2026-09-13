import { Sparkles } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { SuperAdminOverview } from '@/features/dashboard/super-admin/hooks/useSuperAdminOverview';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { CHART_HEIGHT_CLASS, defaultChartMargin } from '@/lib/charts/chartStyles';

const PALETTE = ['#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#f43f5e', '#64748b', '#f97316'];

const FEATURE_LABELS: Record<string, string> = {
  receipt_validation: 'Receipt validation',
  inbox_suggest: 'Inbox suggest',
  inbox_auto_reply: 'Inbox auto-reply',
  marketing_caption: 'Marketing caption',
  marketing_template: 'Marketing template',
  marketing_image_generate: 'Marketing image',
  marketing_video_generate: 'Marketing video',
  import_column_map: 'Import mapping',
  voice_polish: 'Voice polish',
  voice_receptionist: 'Voice receptionist',
  dashboard_assistant: 'Dashboard assistant',
  ai_integration_verify: 'Integration verify',
};

function labelFeature(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature.replace(/_/g, ' ');
}

export function SuperAdminAiCostChart({
  data,
  rangeLabel,
}: {
  data: SuperAdminOverview['aiCostByFeature'];
  rangeLabel: string;
}) {
  const isBelowMd = useIsBelowMd();
  const chartData = data
    .filter((row) => row.costUsd > 0)
    .map((row) => ({ ...row, name: labelFeature(row.feature) }));

  return (
    <section className="surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4">
      <AdminSurfaceCardHeader
        icon={Sparkles}
        title="AI cost by feature"
        description={`Estimated spend (USD) · ${rangeLabel}`}
        iconClassName="bg-muted/80"
      />
      <div className={`${CHART_HEIGHT_CLASS} min-h-0 flex-1`}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ ...defaultChartMargin(isBelowMd), left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={isBelowMd ? 92 : 130}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
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
                formatter={(value: number) => [`$${Number(value).toFixed(4)}`, 'Cost']}
              />
              <Bar dataKey="costUsd" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
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
  );
}
