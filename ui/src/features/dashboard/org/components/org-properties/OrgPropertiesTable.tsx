import { useNavigate } from 'react-router-dom';

import { Calendar, Copy, CopyPlus, ExternalLink, MoreHorizontal, Settings } from 'lucide-react';
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
import { absoluteGuestCalendarUrl } from '@/features/dashboard/org/lib/guestPublicPaths';
import { orgPropertyCardModel } from '@/features/dashboard/org/lib/orgPropertyCardModel';
import {
  formatOrgPropertyCurrency,
  orgPropertyStatsOrEmpty,
  orgPropertyTypeLabel,
} from '@/features/dashboard/org/lib/orgPropertyDisplay';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { Property } from '@/features/dashboard/org/types';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  properties: Property[];
  orgSlug: string;
  onCopySettings?: (propertyId: string) => void;
};

export function OrgPropertiesTable({ properties, orgSlug, onCopySettings }: Props) {
  const navigate = useNavigate();

  return (
    <AdminDataTable minWidth={720}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-3 sm:pl-5">Property</AdminTableTh>
        <AdminTableTh className="hidden md:table-cell">Type</AdminTableTh>
        <AdminTableTh>Status</AdminTableTh>
        <AdminTableTh className="hidden sm:table-cell">Bookings</AdminTableTh>
        <AdminTableTh className="hidden lg:table-cell">Revenue</AdminTableTh>
        <AdminTableTh className="hidden lg:table-cell">Occupancy</AdminTableTh>
        <AdminTableTh className="w-12 pr-2 sm:pr-4">
          <span className="sr-only">Actions</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {properties.map((property, index) => {
          const model = orgPropertyCardModel(property);
          const stats = orgPropertyStatsOrEmpty(property);
          const dashboardHref = propertySectionPath(orgSlug, property.slug, 'dashboard');
          const settingsHref = propertySectionPath(orgSlug, property.slug, 'settings');
          const guestHref = absoluteGuestCalendarUrl(property.slug);

          return (
            <tr
              key={property.id}
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
                  {model.subtitle ? (
                    <p className={cn(adminTableBodyText.secondary, 'truncate')}>{model.subtitle}</p>
                  ) : null}
                </div>
              </td>
              <td className={cn(adminTableCell.body, 'hidden md:table-cell')}>
                <span className={adminTableBodyText.secondary}>
                  {orgPropertyTypeLabel(property.type)}
                </span>
              </td>
              <td className={adminTableCell.body}>
                <OrgPropertyStatusBadge status={property.status} />
              </td>
              <td className={cn(adminTableCell.body, 'hidden sm:table-cell')}>
                <span className={cn(adminTableMoneyClass('text-foreground'))}>
                  {stats.activeBookings}
                </span>
              </td>
              <td className={cn(adminTableCell.money, 'hidden lg:table-cell')}>
                <span className={adminTableMoneyClass('text-foreground')}>
                  {formatOrgPropertyCurrency(stats.monthlyRevenue)}
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
                <OrgPropertyTableActions
                  title={model.title}
                  dashboardHref={dashboardHref}
                  settingsHref={settingsHref}
                  guestHref={guestHref}
                  propertySlug={property.slug}
                  onCopySettings={onCopySettings ? () => onCopySettings(property.id) : undefined}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </AdminDataTable>
  );
}

function OrgPropertyTableActions({
  title,
  dashboardHref,
  settingsHref,
  guestHref,
  propertySlug,
  onCopySettings,
}: {
  title: string;
  dashboardHref: string;
  settingsHref: string;
  guestHref: string;
  propertySlug: string;
  onCopySettings?: () => void;
}) {
  const navigate = useNavigate();

  const primaryActions: ResponsiveOverflowAction[] = [
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
      key: 'guest-calendar',
      label: 'Guest calendar',
      icon: <ExternalLink className="size-4 shrink-0" aria-hidden />,
      onSelect: () => window.open(guestHref, '_blank', 'noopener,noreferrer'),
    },
    {
      key: 'copy-link',
      label: 'Copy guest link',
      icon: <Copy className="size-4 shrink-0" aria-hidden />,
      onSelect: () => {
        void navigator.clipboard
          .writeText(absoluteGuestCalendarUrl(propertySlug))
          .then(() => toast.success('Guest calendar link copied'))
          .catch(() => toast.error('Could not copy link'));
      },
    },
  ];

  const copySettingsAction: ResponsiveOverflowAction[] = onCopySettings
    ? [
        {
          key: 'copy-settings',
          label: 'Copy settings',
          icon: <CopyPlus className="size-4 shrink-0" aria-hidden />,
          onSelect: onCopySettings,
        },
      ]
    : [];

  return (
    <ResponsiveOverflowMenu
      label={`Actions for ${title}`}
      sheetTitle={title}
      sheetDescription="Property actions"
      actionGroups={[primaryActions, copySettingsAction]}
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
