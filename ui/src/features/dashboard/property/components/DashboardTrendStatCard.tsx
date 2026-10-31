import type { ReactNode } from 'react';

import { TrendingDown, TrendingUp } from 'lucide-react';

import { StatCard, type StatCardProps } from '@/components/shared/StatCard';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  changeIsPoints?: boolean;
  icon: LucideIcon;
  iconClassName?: string;
  iconBgClassName?: string;
  valueClassName?: string;
  className?: string;
  footer?: ReactNode;
};

export function DashboardTrendStatCard(props: Props) {
  return <StatCard {...(props as StatCardProps)} />;
}

const RING_SIZE = 76;
const RING_STROKE = 7;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type OccupancyRingCardProps = {
  value: number;
  change?: number;
  changeLabel?: string;
  className?: string;
};

/**
 * Circular-gauge take on the Occupancy Rate KPI — phone/tablet only.
 * `lg+` keeps the flat `DashboardTrendStatCard` for visual consistency with the other three KPIs.
 */
export function DashboardOccupancyRingCard({
  value,
  change,
  changeLabel = 'vs last period',
  className,
}: OccupancyRingCardProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const dashOffset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  const hasChange = change !== undefined;
  const isPositive = hasChange && change >= 0;

  return (
    <div
      className={cn(
        'surface-card flex w-full flex-col items-center gap-2.5 p-3.5 text-center sm:p-3.5',
        className
      )}
    >
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: RING_SIZE, height: RING_SIZE }}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            strokeWidth={RING_STROKE}
            className="stroke-muted fill-none"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="stroke-primary fill-none transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <span className="text-foreground absolute text-base font-bold tabular-nums tracking-tight">
          {Math.round(clamped)}%
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-muted-foreground text-[11px] font-medium leading-tight">
          Occupancy Rate
        </p>
        {hasChange ? (
          <div className="flex flex-wrap items-center justify-center gap-1">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
                isPositive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}
            >
              {isPositive ? (
                <TrendingUp className="size-3" aria-hidden />
              ) : (
                <TrendingDown className="size-3" aria-hidden />
              )}
              {isPositive ? '+' : ''}
              {Math.round(change)} pts
            </span>
            <span className="text-muted-foreground text-xs">{changeLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
