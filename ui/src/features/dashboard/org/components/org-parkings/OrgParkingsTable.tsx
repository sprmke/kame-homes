import { useNavigate } from 'react-router-dom';

import { Calendar, Copy, ExternalLink, MoreHorizontal, Settings } from 'lucide-react';
import { toast } from 'sonner';

import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableMoneyClass,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { OrgPropertyStatusBadge } from '@/features/dashboard/org/components/org-properties/OrgPropertyStatusBadge';
import { absoluteGuestParkingUrl } from '@/features/dashboard/org/lib/guestPublicPaths';
import { orgParkingCardModel } from '@/features/dashboard/org/lib/orgParkingCardModel';
import {
  formatOrgParkingCurrency,
  orgParkingStatsOrEmpty,
  orgParkingTypeLabel,
} from '@/features/dashboard/org/lib/orgParkingDisplay';
import { parkingSectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { Parking } from '@/features/dashboard/org/types';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  parkings: Parking[];
  orgSlug: string;
};

export function OrgParkingsTable({ parkings, orgSlug }: Props) {
  const navigate = useNavigate();

  return (
    <AdminDataTable minWidth={720}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-3 sm:pl-5">Parking</AdminTableTh>
        <AdminTableTh className="hidden md:table-cell">Type</AdminTableTh>
        <AdminTableTh>Status</AdminTableTh>
        <AdminTableTh className="hidden sm:table-cell">Reservations</AdminTableTh>
        <AdminTableTh className="hidden lg:table-cell">Revenue</AdminTableTh>
        <AdminTableTh className="hidden lg:table-cell">Occupancy</AdminTableTh>
        <AdminTableTh className="w-12 pr-2 sm:pr-4">
          <span className="sr-only">Actions</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {parkings.map((parking, index) => {
          const model = orgParkingCardModel(parking);
          const stats = orgParkingStatsOrEmpty(parking);
          const dashboardHref = parkingSectionPath(orgSlug, parking.slug, 'dashboard');
          const settingsHref = parkingSectionPath(orgSlug, parking.slug, 'settings');
          const publicHref = absoluteGuestParkingUrl(parking.slug);

          return (
            <tr
              key={parking.id}
              tabIndex={0}
              className={adminTableRowClass(index)}
              onClick={() => navigate(dashboardHref)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(dashboardHref);
                }
              }}
            >
              <td className={adminTableCell.status}>
                <div className="min-w-0">
                  <p className={cn(adminTableBodyText.primary, 'truncate')}>{model.title}</p>
                </div>
              </td>
              <td className={cn(adminTableCell.body, 'hidden md:table-cell')}>
                <span className={adminTableBodyText.secondary}>
                  {orgParkingTypeLabel(parking.parkingType)}
                </span>
              </td>
              <td className={adminTableCell.body}>
                <OrgPropertyStatusBadge status={parking.status} />
              </td>
              <td className={cn(adminTableCell.body, 'hidden sm:table-cell')}>
                <span className={adminTableMoneyClass('text-foreground')}>
                  {stats.activeReservations}
                </span>
              </td>
              <td className={cn(adminTableCell.money, 'hidden lg:table-cell')}>
                <span className={adminTableMoneyClass('text-foreground')}>
                  {formatOrgParkingCurrency(stats.monthlyRevenue)}
                </span>
              </td>
              <td className={cn(adminTableCell.body, 'hidden lg:table-cell')}>
                <span className={adminTableMoneyClass('text-foreground')}>
                  {stats.occupancyRate}%
                </span>
              </td>
              <td
                className={adminTableCell.action}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <OrgParkingTableActions
                  title={model.title}
                  dashboardHref={dashboardHref}
                  settingsHref={settingsHref}
                  publicHref={publicHref}
                  parkingSlug={parking.slug}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </AdminDataTable>
  );
}

function OrgParkingTableActions({
  title,
  dashboardHref,
  settingsHref,
  publicHref,
  parkingSlug,
}: {
  title: string;
  dashboardHref: string;
  settingsHref: string;
  publicHref: string;
  parkingSlug: string;
}) {
  const navigate = useNavigate();

  const actions: ResponsiveOverflowAction[] = [
    {
      key: 'dashboard',
      label: 'Open dashboard',
      icon: <Calendar className="size-4 shrink-0" aria-hidden />,
      onSelect: () => navigate(dashboardHref),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: <Settings className="size-4 shrink-0" aria-hidden />,
      onSelect: () => navigate(settingsHref),
    },
    {
      key: 'view-parking',
      label: 'View parking',
      icon: <ExternalLink className="size-4 shrink-0" aria-hidden />,
      onSelect: () => window.open(publicHref, '_blank', 'noopener,noreferrer'),
    },
    {
      key: 'copy-link',
      label: 'Copy public link',
      icon: <Copy className="size-4 shrink-0" aria-hidden />,
      onSelect: () => {
        void navigator.clipboard
          .writeText(absoluteGuestParkingUrl(parkingSlug))
          .then(() => toast.success('Public parking link copied'))
          .catch(() => toast.error('Could not copy link'));
      },
    },
  ];

  return (
    <ResponsiveOverflowMenu
      label={`Actions for ${title}`}
      sheetTitle={title}
      sheetDescription="Parking actions"
      actionGroups={[actions]}
      dropdownContentClassName="w-52"
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-9 min-h-[44px] min-w-[44px] sm:size-8 sm:min-h-0 sm:min-w-0"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      }
    />
  );
}
