import { useMemo } from 'react';

import { PieChart as PieChartIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import {
  DASHBOARD_STATUS_BREAKDOWN_ORDER,
  PENDING_DOCUMENTS_BUCKET_STATUSES,
  statusLabel,
  statusTone,
} from '@/features/dashboard/bookings/lib/bookingStatus';
import type { DashboardPipelineSlice } from '@/features/dashboard/property/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { statusToneChartHex } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

type Props = {
  slices: DashboardPipelineSlice[];
  rangeLabel?: string;
  className?: string;
};

type SliceRow = {
  status: string;
  count: number;
  label: string;
  color: string;
};

function sliceColor(status: string): string {
  return statusToneChartHex(statusTone(status));
}

const PENDING_DOCS_BUCKET = new Set<string>(PENDING_DOCUMENTS_BUCKET_STATUSES);

function normalizeStatusSlices(slices: DashboardPipelineSlice[]): SliceRow[] {
  let pendingDocuments = 0;
  const counts = new Map<string, number>();

  for (const slice of slices) {
    if (PENDING_DOCS_BUCKET.has(slice.status)) {
      pendingDocuments += slice.count;
      continue;
    }
    counts.set(slice.status, (counts.get(slice.status) ?? 0) + slice.count);
  }

  return DASHBOARD_STATUS_BREAKDOWN_ORDER.map((status) => ({
    status,
    count: status === 'PENDING_DOCUMENTS' ? pendingDocuments : (counts.get(status) ?? 0),
    label: statusLabel(status),
    color: sliceColor(status),
  }));
}

export function OrgBookingStatusDonut({ slices, rangeLabel, className }: Props) {
  const data = useMemo(() => normalizeStatusSlices(slices), [slices]);
  const chartData = useMemo(() => data.filter((item) => item.count > 0), [data]);
  const total = useMemo(() => chartData.reduce((sum, item) => sum + item.count, 0), [chartData]);

  const summary = data
    .filter((item) => item.count > 0)
    .map((item) => `${item.label}: ${item.count}`)
    .join(', ');

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="Booking status"
    >
      <AdminSurfaceCardHeader
        icon={PieChartIcon}
        title="Booking Status"
        description={rangeLabel ? `Bookings by status · ${rangeLabel}` : 'Bookings by status'}
        iconClassName="bg-muted/80"
      />

      <div className="relative flex min-h-[220px] flex-1 items-center justify-center sm:min-h-[260px]">
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
                  {chartData.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
              <p className="truncate text-center text-base font-bold tabular-nums tracking-tight sm:text-2xl">
                {total}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px] font-medium sm:text-xs">
                Bookings
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="border-muted size-[160px] rounded-full border-[18px] sm:size-[200px] sm:border-[22px]"
              aria-hidden
            />
            <p className="text-muted-foreground text-sm">No bookings in this period</p>
          </div>
        )}
      </div>

      <ul className="sr-only" aria-label={summary || 'No bookings by status in this period'}>
        {data.map((item) => (
          <li key={item.status}>
            {item.label}: {item.count}
          </li>
        ))}
      </ul>
    </section>
  );
}
