import { Eye } from 'lucide-react';

import type { AnalyticsPublicPage } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

type Props = {
  publicPage: AnalyticsPublicPage;
  className?: string;
};

export function PublicPagePerformanceCard({ publicPage, className }: Props) {
  const totalReferrers = publicPage.topReferrers.reduce((sum, r) => sum + r.count, 0);

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader icon={Eye} title="Listing visits" iconClassName="bg-muted/80" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex gap-6">
          <div>
            <p className="text-muted-foreground text-xs font-medium">Page views</p>
            <p className="text-foreground mt-1 text-2xl font-bold tabular-nums">
              {publicPage.pageViews}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">Visitors</p>
            <p className="text-foreground mt-1 text-2xl font-bold tabular-nums">
              {publicPage.uniqueVisitors}
            </p>
          </div>
        </div>

        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium">Top referrers</p>
          {publicPage.topReferrers.length > 0 ? (
            <ul className="space-y-1.5">
              {publicPage.topReferrers.slice(0, 4).map((entry) => (
                <li
                  key={entry.referrer}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{entry.referrer}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {totalReferrers > 0 ? Math.round((entry.count / totalReferrers) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No referrers yet</p>
          )}
        </div>
      </div>
    </section>
  );
}
