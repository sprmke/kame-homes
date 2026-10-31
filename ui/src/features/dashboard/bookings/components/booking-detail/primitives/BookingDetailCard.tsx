import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type BookingDetailCardProps = {
  title: string;
  icon?: LucideIcon;
  /** Optional plan/status pill next to the title (e.g. `<TierBadge>`). */
  badge?: ReactNode;
  action?: ReactNode;
  /** 'edit' applies the primary-tinted header used while editing a section. */
  tone?: 'default' | 'edit';
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * Shared card shell for the booking detail page — used by both view panels
 * and edit-mode tabs so the two states share one visual language.
 */
export function BookingDetailCard({
  title,
  icon: Icon,
  badge,
  action,
  tone = 'default',
  children,
  className,
  bodyClassName,
}: BookingDetailCardProps) {
  return (
    <Card className={cn('overflow-hidden p-0', className)}>
      <div
        className={cn(
          'border-border/70 flex items-center gap-2.5 border-b px-4 py-3.5 sm:px-5',
          tone === 'edit' ? 'bg-primary/[0.04]' : 'bg-muted/25'
        )}
      >
        {Icon ? (
          <span className="icon-well-sm inline-flex !size-8 shrink-0 items-center justify-center sm:!size-9">
            <Icon className="text-primary size-4" />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3 className="text-card-title truncate !text-sm sm:!text-base">{title}</h3>
          {badge}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {/*
       * Rows/list items carry their own `py-2.5`, so the body only adds what the
       * edges are missing: enough top padding to match the 20px gap between rows,
       * and more at the bottom, where the content terminates on the card edge
       * instead of a divider.
       */}
      <div className={cn('px-4 pb-4 pt-2 sm:px-5 sm:pb-5 sm:pt-2.5', bodyClassName)}>
        {children}
      </div>
    </Card>
  );
}
