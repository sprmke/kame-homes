import { Link } from 'react-router-dom';

import {
  OrgAnalyticsAttention,
  OrgAnalyticsKindBadge,
  OrgAnalyticsOutlook,
  OrgAnalyticsRevenueChange,
  orgAnalyticsListingHref,
} from '@/features/dashboard/analytics/components/OrgAnalyticsListingParts';
import {
  orgPortfolioListingKind,
  orgPortfolioListingName,
  type OrgPortfolioRow,
} from '@/features/dashboard/analytics/lib/types';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  row: OrgPortfolioRow;
  orgSlug: string;
};

const CARD_CLASS = cn(
  'surface-card group relative flex min-w-0 flex-col gap-3 p-3.5 transition-colors sm:p-4',
  'hover:bg-muted/30 focus-within:ring-primary/40 focus-within:ring-2'
);

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <div className="text-foreground text-sm font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function Header({ row, orgSlug }: Props) {
  const name = orgPortfolioListingName(row);
  return (
    <div className="min-w-0 space-y-1">
      <OrgAnalyticsKindBadge kind={orgPortfolioListingKind(row)} />
      <Link
        to={orgAnalyticsListingHref(orgSlug, row)}
        className="text-foreground group-hover:text-primary line-clamp-2 text-sm font-semibold transition-colors after:absolute after:inset-0 after:content-[''] sm:text-base"
      >
        {name}
      </Link>
    </div>
  );
}

/** Grid view: stacked card. */
export function OrgAnalyticsListingCard({ row, orgSlug }: Props) {
  return (
    <article className={CARD_CLASS}>
      <Header row={row} orgSlug={orgSlug} />
      {row.locked ? (
        <p className="text-muted-foreground text-xs">Unavailable on your plan</p>
      ) : (
        <>
          <OrgAnalyticsAttention row={row} />
          <div className="border-separator grid grid-cols-3 gap-2 border-t pt-3">
            <Metric label="Occupancy">{row.occupancyRate}%</Metric>
            <Metric label="Revenue">
              <span className="block truncate">{formatMoney(row.grossRevenue)}</span>
              <OrgAnalyticsRevenueChange pct={row.revenueChangePct} />
            </Metric>
            <Metric label="Bookings">{row.reservations}</Metric>
          </div>
          <div className="border-separator border-t pt-3">
            <p className="text-muted-foreground mb-0.5 text-[11px]">Outlook</p>
            <OrgAnalyticsOutlook row={row} />
          </div>
        </>
      )}
    </article>
  );
}

/** List view: one wide row per listing. */
export function OrgAnalyticsListingRow({ row, orgSlug }: Props) {
  return (
    <article className={cn(CARD_CLASS, 'sm:flex-row sm:items-center sm:gap-4')}>
      <div className="min-w-0 sm:w-56 sm:shrink-0">
        <Header row={row} orgSlug={orgSlug} />
      </div>
      {row.locked ? (
        <p className="text-muted-foreground text-xs">Unavailable on your plan</p>
      ) : (
        <>
          <div className="min-w-0 sm:flex-1">
            <OrgAnalyticsAttention row={row} />
          </div>
          <div className="grid grid-cols-4 gap-3 sm:w-[26rem] sm:shrink-0">
            <Metric label="Occupancy">{row.occupancyRate}%</Metric>
            <Metric label="Revenue">
              <span className="block truncate">{formatMoney(row.grossRevenue)}</span>
            </Metric>
            <Metric label="Bookings">{row.reservations}</Metric>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px]">Outlook</p>
              <OrgAnalyticsOutlook row={row} />
            </div>
          </div>
        </>
      )}
    </article>
  );
}
