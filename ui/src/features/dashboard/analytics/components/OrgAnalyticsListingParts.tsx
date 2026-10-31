import { CheckCircle2, AlertTriangle } from 'lucide-react';

import {
  orgAttentionReasons,
  outlookDetail,
  type OrgAnalyticsUnlockedRow,
} from '@/features/dashboard/analytics/lib/orgAnalyticsListings';
import { ORG_OUTLOOK_LABEL } from '@/features/dashboard/analytics/lib/orgPortfolioLabels';
import {
  orgPortfolioListingKind,
  orgPortfolioListingSlug,
  type OrgPortfolioRow,
} from '@/features/dashboard/analytics/lib/types';
import { parkingSectionPath, propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { compactStatusBadgeClasses, resourceKindBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

export function orgAnalyticsListingHref(orgSlug: string, row: OrgPortfolioRow): string {
  const slug = orgPortfolioListingSlug(row);
  return orgPortfolioListingKind(row) === 'parking'
    ? parkingSectionPath(orgSlug, slug, 'dashboard')
    : propertySectionPath(orgSlug, slug, 'analytics');
}

export function OrgAnalyticsKindBadge({ kind }: { kind: 'property' | 'parking' }) {
  return (
    <span className={resourceKindBadgeClasses(kind)}>
      {kind === 'parking' ? 'Parking' : 'Property'}
    </span>
  );
}

/** One verdict per listing: a badge when action is needed, plain text when on track. */
export function OrgAnalyticsAttention({
  row,
  showDetail = true,
  className,
}: {
  row: OrgAnalyticsUnlockedRow;
  showDetail?: boolean;
  className?: string;
}) {
  const reasons = orgAttentionReasons(row);

  if (reasons.length === 0) {
    return (
      <span
        className={cn(
          'text-muted-foreground inline-flex items-center gap-1 text-xs sm:text-[13px]',
          className
        )}
      >
        <CheckCircle2
          className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
        On track
      </span>
    );
  }

  const urgent = reasons[0].severity >= 3;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span
        className={cn(
          compactStatusBadgeClasses(urgent ? 'danger' : 'warning'),
          'w-fit gap-1 normal-case tracking-normal'
        )}
      >
        <AlertTriangle className="size-3 shrink-0" aria-hidden />
        Needs attention
      </span>
      <ul className="text-muted-foreground space-y-0.5 text-[11px] leading-snug sm:text-xs">
        {reasons.map((reason) => (
          <li key={reason.key}>
            <span className="text-foreground font-medium">{reason.label}</span>
            {showDetail ? <span>{`. ${reason.detail}`}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const OUTLOOK_TONE: Record<OrgAnalyticsUnlockedRow['forwardOccupancyState30d'], string> = {
  underbooked: 'text-amber-700 dark:text-amber-300',
  building: 'text-muted-foreground',
  strong: 'text-emerald-700 dark:text-emerald-300',
  fully_booked: 'text-emerald-700 dark:text-emerald-300',
};

/** Outlook is only the next-30-nights state. */
export function OrgAnalyticsOutlook({
  row,
  className,
}: {
  row: OrgAnalyticsUnlockedRow;
  className?: string;
}) {
  const rate = row.forwardOccupancyRate30d;
  return (
    <div className={cn('flex flex-col leading-snug', className)} title={outlookDetail(row)}>
      <span
        className={cn(
          'text-xs font-medium sm:text-[13px]',
          OUTLOOK_TONE[row.forwardOccupancyState30d]
        )}
      >
        {ORG_OUTLOOK_LABEL[row.forwardOccupancyState30d]}
      </span>
      {rate !== undefined ? (
        <span className="text-muted-foreground text-[11px] tabular-nums sm:text-xs">
          {rate}% booked
        </span>
      ) : null}
    </div>
  );
}

export function OrgAnalyticsRevenueChange({ pct }: { pct?: number | null }) {
  if (pct === undefined || pct === null || pct === 0) return null;
  const up = pct > 0;
  return (
    <span
      className={cn(
        'text-[11px] font-medium tabular-nums sm:text-xs',
        up ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
      )}
    >
      {up ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}
