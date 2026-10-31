import { Link } from 'react-router-dom';

import { AlertTriangle, ArrowRight, Bell, CheckCircle2, ChevronRight } from 'lucide-react';

import { orgBookingsPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { DashboardAttentionItem } from '@/features/dashboard/property/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { ATTENTION_SEVERITY_STYLES } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

const MAX_ITEMS = 5;

type Props = {
  orgSlug: string;
  items: DashboardAttentionItem[];
  className?: string;
};

function orgAttentionHref(orgSlug: string, item: DashboardAttentionItem): string {
  const query = item.href.includes('?') ? item.href.split('?')[1] : '';
  const base = orgBookingsPath(orgSlug);
  return query ? `${base}?${query}` : base;
}

export function OrgPendingActionsCard({ orgSlug, items, className }: Props) {
  const criticalCount = items.filter((item) => item.severity === 'critical').length;
  const viewAllHref = orgBookingsPath(orgSlug);
  const visibleItems = items.slice(0, MAX_ITEMS);
  const overflow = Math.max(0, items.length - MAX_ITEMS);

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="Pending actions"
    >
      <AdminSurfaceCardHeader
        icon={Bell}
        title="Pending Actions"
        description="Bookings & documents"
        iconClassName="bg-muted/80"
        action={
          items.length > 0 ? (
            <Link
              to={viewAllHref}
              className="text-primary hover:bg-primary/10 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors"
            >
              View
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
          ) : null
        }
      />

      {items.length > 0 && criticalCount > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold',
              ATTENTION_SEVERITY_STYLES.critical.chip,
              'text-rose-800 dark:text-rose-200'
            )}
          >
            <AlertTriangle className="size-3 shrink-0" aria-hidden />
            {criticalCount} urgent
          </span>
          {items.length > criticalCount ? (
            <span className="border-border/60 bg-muted/40 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums">
              {items.length - criticalCount} more
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        {items.length === 0 ? (
          <div className="border-border/60 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center">
            <CheckCircle2 className="text-muted-foreground/70 size-6" aria-hidden />
            <p className="text-foreground text-sm font-semibold">All clear</p>
          </div>
        ) : (
          <>
            <ul className="border-border/50 divide-border/50 divide-y overflow-hidden rounded-xl border">
              {visibleItems.map((item) => {
                const style = ATTENTION_SEVERITY_STYLES[item.severity];
                const href = orgAttentionHref(orgSlug, item);

                return (
                  <li key={item.id}>
                    <Link
                      to={href}
                      className="hover:bg-muted/35 group flex min-h-[40px] items-center gap-2.5 px-3 py-2 transition-colors"
                    >
                      <span className={cn('size-2 shrink-0 rounded-full', style.dot)} aria-hidden />
                      <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                        {item.label}
                      </span>
                      {item.count != null ? (
                        <span
                          className={cn('shrink-0 text-sm font-bold tabular-nums', style.count)}
                        >
                          {item.count}
                        </span>
                      ) : (
                        <ChevronRight
                          className="text-muted-foreground size-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {overflow > 0 ? (
              <Link
                to={viewAllHref}
                className="border-border/60 bg-muted/30 text-primary hover:bg-primary/10 mt-3 flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                View all
                <span className="text-muted-foreground font-medium">(+{overflow} more)</span>
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
