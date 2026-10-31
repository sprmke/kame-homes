import { Link, useNavigate } from 'react-router-dom';

import {
  Building2,
  Calendar,
  Copy,
  CopyPlus,
  ExternalLink,
  MoreHorizontal,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

import { OrgPropertyImageCarousel } from '@/features/dashboard/org/components/org-properties/OrgPropertyImageCarousel';
import { OrgPropertyStatusBadge } from '@/features/dashboard/org/components/org-properties/OrgPropertyStatusBadge';
import { absoluteGuestCalendarUrl } from '@/features/dashboard/org/lib/guestPublicPaths';
import { orgPropertyCardModel } from '@/features/dashboard/org/lib/orgPropertyCardModel';
import {
  formatOrgPropertyCurrency,
  orgPropertyStatsOrEmpty,
} from '@/features/dashboard/org/lib/orgPropertyDisplay';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { Property } from '@/features/dashboard/org/types';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';

const ORG_PROPERTY_CARD_CLASS =
  'relative block rounded-xl border border-border/50 bg-card text-card-foreground shadow-card overflow-hidden transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-lg dark:border-[hsl(0_0%_100%_/_0.06)]';

const ORG_PROPERTY_CARD_LINK_CLASS =
  'absolute inset-0 z-[1] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

type Props = {
  property: Property;
  orgSlug: string;
  hideStats?: boolean;
  organizationName?: string | null;
  developmentName?: string | null;
  developmentHref?: string | null;
  onCopySettings?: (propertyId: string) => void;
};

async function copyGuestLink(propertySlug: string) {
  try {
    await navigator.clipboard.writeText(absoluteGuestCalendarUrl(propertySlug));
    toast.success('Guest calendar link copied');
  } catch {
    toast.error('Could not copy link');
  }
}

function OrgPropertyPlatformContext({
  organizationName,
  developmentName,
  developmentHref,
}: {
  organizationName?: string | null;
  developmentName?: string | null;
  developmentHref?: string | null;
}) {
  const development = developmentName?.trim() || null;
  if (!organizationName?.trim() && !development) return null;

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
      {organizationName?.trim() ? (
        <span className="truncate">{organizationName.trim()}</span>
      ) : null}
      {organizationName?.trim() && development ? <span aria-hidden>·</span> : null}
      {developmentHref && development ? (
        <Link
          to={developmentHref}
          className="text-primary pointer-events-auto relative z-[3] truncate hover:underline"
        >
          {development}
        </Link>
      ) : development ? (
        <span className="truncate">{development}</span>
      ) : null}
    </div>
  );
}

function OrgPropertyLocationLine({ locationLine }: { locationLine: string }) {
  const line = locationLine.trim();
  if (!line) return null;

  return <p className="text-muted-foreground line-clamp-1 text-xs">{line}</p>;
}

function OrgPropertyStatsRow({ property }: { property: Property }) {
  const stats = orgPropertyStatsOrEmpty(property);

  return (
    <div className="border-border/50 border-t pt-2.5 sm:pt-3">
      <div className="grid grid-cols-3 gap-1 text-center sm:gap-2 sm:text-sm">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] sm:text-xs">Bookings</p>
          <p className="text-foreground text-xs font-semibold tabular-nums sm:text-sm">
            {stats.activeBookings}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] sm:text-xs">Revenue</p>
          <p className="text-foreground truncate text-xs font-semibold tabular-nums sm:text-sm">
            {formatOrgPropertyCurrency(stats.monthlyRevenue)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] sm:text-xs">Occupancy</p>
          <p className="text-foreground text-xs font-semibold tabular-nums sm:text-sm">
            {stats.occupancyRate}%
          </p>
        </div>
      </div>
    </div>
  );
}

function OrgPropertyActionsMenu({
  property,
  dashboardHref,
  settingsHref,
  guestHref,
  onCopySettings,
}: {
  property: Property;
  dashboardHref: string;
  settingsHref: string;
  guestHref: string;
  onCopySettings?: () => void;
}) {
  const navigate = useNavigate();
  const model = orgPropertyCardModel(property);

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
        void copyGuestLink(property.slug);
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
      label={`Actions for ${model.title}`}
      sheetTitle={model.title}
      sheetDescription="Property actions"
      actionGroups={[primaryActions, copySettingsAction]}
      dropdownContentClassName="w-52"
      trigger={
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="bg-background/90 size-8 shadow-sm backdrop-blur-sm"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      }
    />
  );
}

export function OrgPropertyCard({
  property,
  orgSlug,
  hideStats = false,
  organizationName,
  developmentName,
  developmentHref,
  onCopySettings,
}: Props) {
  const navigate = useNavigate();
  const model = orgPropertyCardModel(property);
  const dashboardHref = propertySectionPath(orgSlug, property.slug, 'dashboard');
  const settingsHref = propertySectionPath(orgSlug, property.slug, 'settings');
  const guestHref = absoluteGuestCalendarUrl(property.slug);

  return (
    <article className={`${ORG_PROPERTY_CARD_CLASS} group`}>
      <Link
        to={dashboardHref}
        className={ORG_PROPERTY_CARD_LINK_CLASS}
        aria-label={`Open ${model.title}`}
      />

      <div className="relative z-[2]">
        <OrgPropertyImageCarousel
          images={model.imageUrls}
          name={model.title}
          className="rounded-t-xl"
          onSurfaceClick={() => navigate(dashboardHref)}
        />
        <div className="pointer-events-none absolute left-3 top-3 z-10">
          <OrgPropertyStatusBadge status={property.status} />
        </div>
        <div className="absolute right-3 top-3 z-[3] opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <OrgPropertyActionsMenu
            property={property}
            dashboardHref={dashboardHref}
            settingsHref={settingsHref}
            guestHref={guestHref}
            onCopySettings={onCopySettings ? () => onCopySettings(property.id) : undefined}
          />
        </div>
      </div>

      <div className="pointer-events-none relative z-[2] space-y-2.5 p-3 sm:space-y-3 sm:p-4">
        <div className="min-w-0 space-y-1">
          <p className="lg:text-md text-foreground group-hover:text-primary line-clamp-1 text-sm font-semibold transition-colors sm:text-base">
            {model.title}
          </p>
          {model.subtitle ? (
            <p className="text-muted-foreground line-clamp-1 text-sm">{model.subtitle}</p>
          ) : null}
          <OrgPropertyPlatformContext
            organizationName={organizationName}
            developmentName={developmentName}
            developmentHref={developmentHref}
          />
          <OrgPropertyLocationLine locationLine={model.locationLine} />
        </div>

        {hideStats ? null : <OrgPropertyStatsRow property={property} />}
      </div>
    </article>
  );
}

export function OrgPropertyListRow({
  property,
  orgSlug,
  hideStats = false,
  organizationName,
  developmentName,
  developmentHref,
  onCopySettings,
}: Props) {
  const navigate = useNavigate();
  const model = orgPropertyCardModel(property);
  const stats = orgPropertyStatsOrEmpty(property);
  const dashboardHref = propertySectionPath(orgSlug, property.slug, 'dashboard');
  const settingsHref = propertySectionPath(orgSlug, property.slug, 'settings');
  const guestHref = absoluteGuestCalendarUrl(property.slug);

  return (
    <article className={`${ORG_PROPERTY_CARD_CLASS} group`}>
      <Link
        to={dashboardHref}
        className={ORG_PROPERTY_CARD_LINK_CLASS}
        aria-label={`Open ${model.title}`}
      />

      <div className="relative z-[2] flex flex-col gap-4 p-4 sm:flex-row">
        <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl sm:h-44 sm:w-52">
          <OrgPropertyImageCarousel
            images={model.imageUrls}
            name={model.title}
            className="aspect-auto size-full rounded-xl"
            onSurfaceClick={() => navigate(dashboardHref)}
          />
          <div className="pointer-events-none absolute left-2 top-2 z-10">
            <OrgPropertyStatusBadge status={property.status} />
          </div>
        </div>

        <div className="pointer-events-none flex min-w-0 flex-1 flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-foreground group-hover:text-primary line-clamp-1 text-sm font-semibold transition-colors sm:text-base lg:text-lg">
                  {model.title}
                </p>
                {model.subtitle ? (
                  <p className="text-muted-foreground line-clamp-1 text-sm">{model.subtitle}</p>
                ) : null}
                <OrgPropertyPlatformContext
                  organizationName={organizationName}
                  developmentName={developmentName}
                  developmentHref={developmentHref}
                />
                <OrgPropertyLocationLine locationLine={model.locationLine} />
              </div>

              <div className="pointer-events-auto relative z-[3] shrink-0">
                <OrgPropertyActionsMenu
                  property={property}
                  dashboardHref={dashboardHref}
                  settingsHref={settingsHref}
                  guestHref={guestHref}
                  onCopySettings={onCopySettings ? () => onCopySettings(property.id) : undefined}
                />
              </div>
            </div>

            {model.description ? (
              <p className="text-muted-foreground line-clamp-2 text-sm">{model.description}</p>
            ) : null}
          </div>

          {hideStats ? null : (
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Bookings: </span>
                <span className="text-foreground font-semibold tabular-nums">
                  {stats.activeBookings}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Revenue: </span>
                <span className="text-foreground font-semibold tabular-nums">
                  {formatOrgPropertyCurrency(stats.monthlyRevenue)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Occupancy: </span>
                <span className="text-foreground font-semibold tabular-nums">
                  {stats.occupancyRate}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function OrgPropertiesEmptyState({
  filtered,
  canAdd = false,
  onAdd,
}: {
  filtered: boolean;
  canAdd?: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 px-4 py-14 text-center sm:py-16">
      <div className="icon-well-sm inline-flex items-center justify-center">
        <Building2 className="text-muted-foreground size-5" aria-hidden />
      </div>
      <p className="text-foreground text-sm font-semibold">
        {filtered ? 'No properties found' : 'No properties yet'}
      </p>
      {!filtered && canAdd ? (
        <Button type="button" onClick={onAdd} className="min-h-[44px]">
          Add property
        </Button>
      ) : null}
    </div>
  );
}
