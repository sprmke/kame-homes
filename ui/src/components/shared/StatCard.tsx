import type { CSSProperties, ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { TrendingDown, TrendingUp } from 'lucide-react';

import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

import type { LucideIcon } from 'lucide-react';

/** Neutral KPI icon well. Default when callers omit color classes. */
export const STAT_CARD_ICON_MUTED = {
  iconClassName: 'text-muted-foreground',
  iconBgClassName: 'bg-muted',
} as const;

export type StatCardProps = {
  title: string;
  /** Optional control rendered right after the title (e.g. a metric info tooltip). */
  titleAdornment?: ReactNode;
  value: string;
  icon?: LucideIcon;
  iconClassName?: string;
  iconBgClassName?: string;
  valueClassName?: string;
  className?: string;
  change?: number;
  changeLabel?: string;
  /** When true, `change` is shown as percentage points (e.g. occupancy). */
  changeIsPoints?: boolean;
  footer?: ReactNode;
  onClick?: () => void;
  /** When set, the card renders as a router link instead of a button. */
  to?: string;
  active?: boolean;
};

function formatChange(change: number, isPoints: boolean): string {
  const sign = change > 0 ? '+' : '';
  if (isPoints) return `${sign}${Math.round(change)} pts`;
  return `${sign}${change.toFixed(1)}%`;
}

export function StatCard({
  title,
  titleAdornment,
  value,
  icon: Icon,
  iconClassName = STAT_CARD_ICON_MUTED.iconClassName,
  iconBgClassName = STAT_CARD_ICON_MUTED.iconBgClassName,
  valueClassName,
  className,
  change,
  changeLabel = 'vs last period',
  changeIsPoints = false,
  footer,
  onClick,
  to,
  active,
}: StatCardProps) {
  const hasChange = change !== undefined;
  const isPositive = change !== undefined && change >= 0;
  const interactive = onClick !== undefined || to !== undefined;
  const compactChrome = useDashboardCompactChrome();
  const showIcon = Icon && !compactChrome;

  const shellClassName = cn(
    'surface-card group relative flex h-full w-full flex-col items-start justify-start overflow-hidden p-3 text-left transition-all duration-300 sm:p-3.5 md:p-5',
    interactive && 'native-press',
    'sm:hover:shadow-elevated-lg sm:hover:-translate-y-0.5',
    interactive &&
      'focus-visible:ring-primary/40 text-left focus-visible:outline-none focus-visible:ring-2',
    active &&
      'border-primary/50 bg-primary/[0.06] shadow-card-hover ring-primary/40 ring-2 ring-inset sm:hover:translate-y-0',
    className
  );

  const body = (
    <>
      <div className="from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity group-hover:opacity-100 max-lg:hidden" />
      <div
        className={cn(
          'relative flex w-full flex-col items-start justify-start',
          footer && 'space-y-2 sm:space-y-2.5'
        )}
      >
        <div className="flex w-full items-start justify-between gap-2.5 sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
            <div className="flex items-start gap-0.5">
              <p className="text-muted-foreground line-clamp-2 text-xs font-medium leading-snug sm:line-clamp-none sm:text-sm">
                {title}
              </p>
              {titleAdornment ? <span className="shrink-0">{titleAdornment}</span> : null}
            </div>
            <p
              className={cn(
                valueClassName?.includes('line-clamp')
                  ? 'font-bold tracking-tight'
                  : 'text-stat-value truncate',
                // Color override only — do not append `text-foreground` (token already
                // sets it; a trailing text-* color used to make twMerge drop the token).
                valueClassName
              )}
            >
              {value}
            </p>
            {hasChange ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:text-xs sm:font-medium',
                    isPositive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}
                  title={changeLabel}
                >
                  {isPositive ? (
                    <TrendingUp className="size-3" aria-hidden />
                  ) : (
                    <TrendingDown className="size-3" aria-hidden />
                  )}
                  {formatChange(change, changeIsPoints)}
                </span>
                <span className="text-muted-foreground hidden text-xs lg:inline">
                  {changeLabel}
                </span>
              </div>
            ) : null}
          </div>
          {showIcon ? (
            <div
              data-stat-card-icon
              className={cn(
                'native-icon-tile hidden transition-transform sm:group-hover:scale-110 lg:flex',
                iconBgClassName
              )}
            >
              <Icon className={cn('size-4 sm:size-5', iconClassName)} aria-hidden />
            </div>
          ) : null}
        </div>
        {footer ? <div className="w-full shrink-0 self-start">{footer}</div> : null}
      </div>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={shellClassName}
      >
        {body}
      </Link>
    );
  }

  if (interactive) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={shellClassName}>
        {body}
      </button>
    );
  }

  return <div className={shellClassName}>{body}</div>;
}

type StatCardSkeletonProps = {
  showTrend?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function StatCardSkeleton({ showTrend = false, className, style }: StatCardSkeletonProps) {
  return (
    <div className={cn('surface-card p-3 sm:p-3.5 md:p-4', className)} style={style}>
      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
          <Skeleton className="h-3 w-20 sm:h-4 sm:w-24" />
          <Skeleton className="h-6 w-20 sm:h-8 sm:w-32" />
          {showTrend ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="hidden h-3 w-20 lg:block" />
            </div>
          ) : null}
        </div>
        <Skeleton className="hidden size-8 shrink-0 rounded-lg sm:size-10 sm:rounded-xl lg:block" />
      </div>
    </div>
  );
}

type MoneyStatCardProps = Omit<StatCardProps, 'value'> & {
  value: number;
};

/** Stat card with PHP currency formatting. */
export function MoneyStatCard({ value, ...props }: MoneyStatCardProps) {
  return <StatCard {...props} value={formatMoney(value)} />;
}

/** Responsive 4-column grid used by dashboard KPI rows. */
export function StatCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'native-stagger grid grid-cols-2 items-start gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4',
        className
      )}
    >
      {children}
    </div>
  );
}
