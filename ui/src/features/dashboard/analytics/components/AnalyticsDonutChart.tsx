import { useMemo, useState } from 'react';

import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';

import { cn } from '@/lib/utils';

export type AnalyticsDonutSlice = {
  key: string;
  label: string;
  count: number;
  color: string;
};

type Props = {
  slices: AnalyticsDonutSlice[];
  centerValue: number;
  centerLabel: string;
  emptyMessage: string;
  compact?: boolean;
  className?: string;
};

const DONUT_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
  '#ef4444',
  '#14b8a6',
];

export function analyticsDonutColor(index: number): string {
  return DONUT_COLORS[index % DONUT_COLORS.length];
}

type ChartPoint = AnalyticsDonutSlice & { pct: number };

type ActiveShapeProps = {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
};

function ActiveDonutShape(props: ActiveShapeProps) {
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill,
  } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 4}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="hsl(var(--card))"
      strokeWidth={2}
    />
  );
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="border-border bg-card rounded-lg border px-3 py-2 shadow-lg">
      <p className="text-foreground text-sm font-semibold">{point.label}</p>
      <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
        {point.pct}% · {point.count}
      </p>
    </div>
  );
}

export function AnalyticsDonutChart({
  slices,
  centerValue,
  centerLabel,
  emptyMessage,
  compact = false,
  className,
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const chartData = useMemo(() => {
    const total = slices.reduce((sum, s) => sum + s.count, 0);
    return slices.map((slice) => ({
      ...slice,
      pct: total > 0 ? Math.round((slice.count / total) * 100) : 0,
    }));
  }, [slices]);

  return (
    <div
      className={cn(
        'relative flex flex-1 items-center justify-center overflow-visible',
        compact ? 'min-h-[160px] sm:min-h-[180px]' : 'min-h-[220px] sm:min-h-[260px]',
        className
      )}
    >
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
                activeIndex={activeIndex}
                activeShape={ActiveDonutShape}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={<DonutTooltip />}
                offset={16}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 40, outline: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] flex w-[45%] max-w-[7.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
            <p className="truncate text-center text-base font-bold tabular-nums tracking-tight sm:text-2xl">
              {centerValue}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px] font-medium sm:text-xs">
              {centerLabel}
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div
            className="border-muted size-[160px] rounded-full border-[18px] sm:size-[200px] sm:border-[22px]"
            aria-hidden
          />
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
