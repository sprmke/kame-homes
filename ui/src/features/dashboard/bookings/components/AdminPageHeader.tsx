import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type AdminPageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Optional plan/status pill next to the title (e.g. `<TierBadge>`). */
  badge?: ReactNode;
  actions?: ReactNode;
  /** Optional classes on the actions wrapper. */
  actionsClassName?: string;
  className?: string;
  id?: string;
  /**
   * `compact` — title row + actions on one line (Bookings, Finance).
   * Typography matches `default` on all breakpoints.
   */
  variant?: 'default' | 'compact';
  /** Wrap header in a surface card. Defaults to true for `compact`. */
  card?: boolean;
  /** Pin on desktop only (`lg:top-5`). On mobile the header scrolls with the page. */
  sticky?: boolean;
};

export function AdminPageHeader({
  title,
  subtitle,
  badge,
  actions,
  actionsClassName,
  className,
  id,
  variant = 'default',
  card,
  sticky = false,
}: AdminPageHeaderProps) {
  const compact = variant === 'compact';
  const rowWithActions = compact && actions;
  const useCard = card ?? compact;

  const content = (
    <div
      className={cn(
        rowWithActions
          ? 'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'
          : 'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4',
        compact && !rowWithActions && 'sm:items-center',
        !useCard && className
      )}
    >
      {/* Actions wrap below the title when both don't fit (narrow panes, AI mode canvas). */}
      <div className="min-w-0 flex-1 space-y-0.5 sm:min-w-[14rem]">
        <div className="flex items-center gap-2.5">
          <h1 id={id} className="text-admin-page-title">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle ? (
          <p className="text-admin-page-subtitle max-sm:line-clamp-2">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className={cn('flex shrink-0 items-center gap-1.5', actionsClassName)}>{actions}</div>
      ) : null}
    </div>
  );

  if (!useCard) {
    return content;
  }

  return (
    <section
      className={cn(
        'mb-3 w-full',
        sticky && 'lg:bg-card lg:sticky lg:top-5 lg:z-10 lg:shadow-sm',
        className
      )}
    >
      {content}
    </section>
  );
}
