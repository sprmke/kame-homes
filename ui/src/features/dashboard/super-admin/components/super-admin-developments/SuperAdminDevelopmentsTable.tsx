import { useNavigate } from 'react-router-dom';

import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableRowAffordance,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import {
  developmentStatusLabel,
  developmentTypeLabel,
} from '@/features/dashboard/super-admin/lib/developmentSettingsConstants';
import { superAdminDevelopmentCardModel } from '@/features/dashboard/super-admin/lib/superAdminDevelopmentsFilters';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import type { Development } from '@/features/dashboard/super-admin/types/development';

import { listingStatusBadgeClasses, listingStatusDotClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

function DevelopmentStatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span className={listingStatusBadgeClasses(active)}>
      <span className={listingStatusDotClasses(active)} aria-hidden />
      {developmentStatusLabel(status as Development['status'])}
    </span>
  );
}

type Props = {
  developments: Development[];
};

export function SuperAdminDevelopmentsTable({ developments }: Props) {
  const navigate = useNavigate();

  return (
    <AdminDataTable minWidth={720}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Name</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Developer</AdminTableTh>
        <AdminTableTh className="hidden px-3 md:table-cell md:px-4">Type</AdminTableTh>
        <AdminTableTh className="hidden px-3 lg:table-cell lg:px-4">Location</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Properties</AdminTableTh>
        <AdminTableTh className="hidden px-3 md:table-cell md:px-4">Parking</AdminTableTh>
        <AdminTableTh className="px-3 sm:px-4">Status</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">Open</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {developments.map((development, index) => {
          const model = superAdminDevelopmentCardModel(development);
          const href = superAdminPaths.developmentDetail(development.slug);

          return (
            <tr
              key={development.id}
              className={adminTableRowClass(index)}
              tabIndex={0}
              role="link"
              onClick={() => navigate(href)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(href);
                }
              }}
              aria-label={`Open ${development.name}`}
            >
              <td className={adminTableCell.body}>
                <div className="min-w-[140px]">
                  <p className={cn('truncate', adminTableBodyText.primary)}>{model.title}</p>
                  <p className={cn('truncate sm:hidden', adminTableBodyText.secondary)}>
                    {model.subtitle ?? model.locationLine}
                  </p>
                </div>
              </td>
              <td className={cn(adminTableCell.body, 'hidden sm:table-cell')}>
                <p className={cn('max-w-[12rem] truncate', adminTableBodyText.secondary)}>
                  {model.subtitle ?? '-'}
                </p>
              </td>
              <td className={cn(adminTableCell.body, 'hidden md:table-cell')}>
                <p className={adminTableBodyText.secondary}>
                  {developmentTypeLabel(development.type)}
                </p>
              </td>
              <td className={cn(adminTableCell.body, 'hidden lg:table-cell')}>
                <p className={cn('max-w-[14rem] truncate', adminTableBodyText.secondary)}>
                  {model.locationLine}
                </p>
              </td>
              <td
                className={cn(adminTableCell.body, 'hidden text-right tabular-nums sm:table-cell')}
              >
                {development.stats.propertyCount}
              </td>
              <td
                className={cn(adminTableCell.body, 'hidden text-right tabular-nums md:table-cell')}
              >
                {development.stats.parkingCount}
              </td>
              <td className={adminTableCell.status}>
                <DevelopmentStatusBadge status={development.status} />
              </td>
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
