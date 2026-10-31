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
import { hostDisplayInitial } from '@/features/dashboard/super-admin/lib/superAdminHostsFilters';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import type { HostSummary } from '@/features/dashboard/super-admin/types/host';

import { cn } from '@/lib/utils';

function HostAvatar({ host, className }: { host: HostSummary; className?: string }) {
  const initial = hostDisplayInitial(host.name, host.email);
  if (host.avatarUrl) {
    return (
      <img
        src={host.avatarUrl}
        alt=""
        className={cn('rounded-full object-cover', className)}
        width={36}
        height={36}
      />
    );
  }

  return (
    <div
      className={cn(
        'gradient-primary text-primary-foreground flex items-center justify-center rounded-full text-sm font-bold',
        className
      )}
    >
      {initial}
    </div>
  );
}

type Props = {
  hosts: HostSummary[];
};

export function SuperAdminHostsTable({ hosts }: Props) {
  const navigate = useNavigate();

  return (
    <AdminDataTable minWidth={640}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Host</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Orgs</AdminTableTh>
        <AdminTableTh className="hidden px-3 md:table-cell md:px-4">Properties</AdminTableTh>
        <AdminTableTh className="hidden px-3 lg:table-cell lg:px-4">Parking</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">Open</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {hosts.map((host, index) => {
          const href = superAdminPaths.hostDetail(host.id);

          return (
            <tr
              key={host.id}
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
              aria-label={`Open ${host.name}`}
            >
              <td className={adminTableCell.body}>
                <div className="flex min-w-[160px] items-center gap-2.5 sm:min-w-[200px] sm:gap-3">
                  <HostAvatar host={host} className="size-9 shrink-0" />
                  <div className="min-w-0">
                    <p className={cn('truncate', adminTableBodyText.primary)}>{host.name}</p>
                    {host.email ? (
                      <p className={cn('truncate', adminTableBodyText.secondary)}>{host.email}</p>
                    ) : null}
                    <p className={cn('mt-1 tabular-nums sm:hidden', adminTableBodyText.secondary)}>
                      {host.stats.organizationCount} org · {host.stats.propertyCount} prop
                    </p>
                  </div>
                </div>
              </td>
              <td
                className={cn(adminTableCell.body, 'hidden text-right tabular-nums sm:table-cell')}
              >
                {host.stats.organizationCount}
              </td>
              <td
                className={cn(adminTableCell.body, 'hidden text-right tabular-nums md:table-cell')}
              >
                {host.stats.propertyCount}
              </td>
              <td
                className={cn(adminTableCell.body, 'hidden text-right tabular-nums lg:table-cell')}
              >
                {host.stats.parkingCount}
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
