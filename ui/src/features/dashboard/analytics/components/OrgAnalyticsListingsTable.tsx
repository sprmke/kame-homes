import { useNavigate } from 'react-router-dom';

import { ArrowDown, ArrowUp } from 'lucide-react';

import {
  OrgAnalyticsAttention,
  OrgAnalyticsKindBadge,
  OrgAnalyticsOutlook,
  OrgAnalyticsRevenueChange,
  orgAnalyticsListingHref,
} from '@/features/dashboard/analytics/components/OrgAnalyticsListingParts';
import type {
  OrgAnalyticsSort,
  OrgAnalyticsSortKey,
} from '@/features/dashboard/analytics/lib/orgAnalyticsListings';
import {
  orgPortfolioListingId,
  orgPortfolioListingKind,
  orgPortfolioListingName,
  type OrgPortfolioRow,
} from '@/features/dashboard/analytics/lib/types';
import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableRowAffordance,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableMoneyClass,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  rows: OrgPortfolioRow[];
  orgSlug: string;
  sort: OrgAnalyticsSort;
  onSortChange: (key: OrgAnalyticsSortKey) => void;
};

/** Match `adminTableCell` horizontal padding so headers sit over their cells. */
const HEAD_PAD = {
  listing: 'pl-3 pr-2 sm:pl-5 sm:pr-3',
  body: 'px-2 sm:px-4',
  action: 'pl-1 pr-2 sm:pl-2 sm:pr-4',
} as const;

function SortHead({
  label,
  sortKey,
  sort,
  onSortChange,
  className,
}: {
  label: string;
  sortKey: OrgAnalyticsSortKey;
  sort: OrgAnalyticsSort;
  onSortChange: (key: OrgAnalyticsSortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <AdminTableTh className={className}>
      <button
        type="button"
        onClick={() => onSortChange(sortKey)}
        className="hover:text-foreground inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap sm:min-h-0"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ? (
          sort.desc ? (
            <ArrowDown className="size-3 shrink-0" aria-hidden />
          ) : (
            <ArrowUp className="size-3 shrink-0" aria-hidden />
          )
        ) : null}
      </button>
    </AdminTableTh>
  );
}

export function OrgAnalyticsListingsTable({ rows, orgSlug, sort, onSortChange }: Props) {
  const navigate = useNavigate();

  return (
    <AdminDataTable minWidth={960}>
      <AdminTableHeadRow>
        <SortHead
          label="Listing"
          sortKey="name"
          sort={sort}
          onSortChange={onSortChange}
          className={HEAD_PAD.listing}
        />
        <AdminTableTh className={HEAD_PAD.body}>Type</AdminTableTh>
        <AdminTableTh className={HEAD_PAD.body}>Attention</AdminTableTh>
        <SortHead
          label="Occupancy"
          sortKey="occupancy"
          sort={sort}
          onSortChange={onSortChange}
          className={HEAD_PAD.body}
        />
        <SortHead
          label="Revenue"
          sortKey="revenue"
          sort={sort}
          onSortChange={onSortChange}
          className={HEAD_PAD.body}
        />
        <SortHead
          label="Bookings"
          sortKey="bookings"
          sort={sort}
          onSortChange={onSortChange}
          className={HEAD_PAD.body}
        />
        <SortHead
          label="Outlook"
          sortKey="outlook"
          sort={sort}
          onSortChange={onSortChange}
          className={HEAD_PAD.body}
        />
        <AdminTableTh className={cn(HEAD_PAD.action, 'w-12')}>
          <span className="sr-only">Open</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {rows.map((row, index) => {
          const kind = orgPortfolioListingKind(row);
          const name = orgPortfolioListingName(row);
          const href = orgAnalyticsListingHref(orgSlug, row);
          return (
            <tr
              key={`${kind}-${orgPortfolioListingId(row)}`}
              tabIndex={0}
              className={adminTableRowClass(index)}
              onClick={() => navigate(href)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(href);
                }
              }}
            >
              <td className={adminTableCell.status}>
                <p className={cn(adminTableBodyText.primary, 'max-w-[14rem] truncate')}>{name}</p>
              </td>
              <td className={adminTableCell.body}>
                <OrgAnalyticsKindBadge kind={kind} />
              </td>
              {row.locked ? (
                <td colSpan={5} className={cn(adminTableCell.body, adminTableBodyText.secondary)}>
                  Unavailable on your plan
                </td>
              ) : (
                <>
                  <td className={cn(adminTableCell.body, 'min-w-[12rem] max-w-[18rem]')}>
                    <OrgAnalyticsAttention row={row} />
                  </td>
                  <td className={adminTableCell.money}>
                    <span className={adminTableMoneyClass('text-foreground')}>
                      {row.occupancyRate}%
                    </span>
                  </td>
                  <td className={adminTableCell.money}>
                    <div className="flex flex-col items-start">
                      <span className={adminTableMoneyClass('text-foreground')}>
                        {formatMoney(row.grossRevenue)}
                      </span>
                      <OrgAnalyticsRevenueChange pct={row.revenueChangePct} />
                    </div>
                  </td>
                  <td className={adminTableCell.money}>
                    <span className={adminTableMoneyClass('text-foreground')}>
                      {row.reservations}
                    </span>
                  </td>
                  <td className={adminTableCell.body}>
                    <OrgAnalyticsOutlook row={row} />
                  </td>
                </>
              )}
              <td className={adminTableCell.action}>
                <AdminTableRowAffordance />
              </td>
            </tr>
          );
        })}
      </tbody>
    </AdminDataTable>
  );
}
