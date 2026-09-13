import { Link, useNavigate } from 'react-router-dom';

import { Building2, Car, Landmark, MoreHorizontal, Settings } from 'lucide-react';

import { OrgPropertyImageCarousel } from '@/features/dashboard/org/components/org-properties/OrgPropertyImageCarousel';
import { superAdminDevelopmentCardModel } from '@/features/dashboard/super-admin/lib/superAdminDevelopmentsFilters';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import type { Development } from '@/features/dashboard/super-admin/types/development';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';
import { listingStatusBadgeClasses, listingStatusDotClasses } from '@/lib/statusToneColors';

const CARD_CLASS =
  'relative block rounded-xl border border-border/50 bg-card text-card-foreground shadow-card overflow-hidden transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-lg dark:border-[hsl(0_0%_100%_/_0.06)]';

const CARD_LINK_CLASS =
  'absolute inset-0 z-[1] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function DevelopmentStatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span className={listingStatusBadgeClasses(active)}>
      <span className={listingStatusDotClasses(active)} aria-hidden />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

type Props = {
  development: Development;
};

function DevelopmentActionsMenu({
  development,
  settingsHref,
}: {
  development: Development;
  settingsHref: string;
}) {
  const navigate = useNavigate();
  const model = superAdminDevelopmentCardModel(development);
  const actions: ResponsiveOverflowAction[] = [
    {
      key: 'settings',
      label: 'Settings',
      icon: <Settings className="size-4 shrink-0" aria-hidden />,
      onSelect: () => navigate(settingsHref),
    },
  ];

  return (
    <ResponsiveOverflowMenu
      label={`Actions for ${model.title}`}
      sheetTitle={model.title}
      actionGroups={[actions]}
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

export function SuperAdminDevelopmentCard({ development }: Props) {
  const navigate = useNavigate();
  const model = superAdminDevelopmentCardModel(development);
  const settingsHref = superAdminPaths.developmentDetail(development.slug);
  const imageUrls = model.thumbnailUrl ? [model.thumbnailUrl, ...([] as string[])] : [];

  return (
    <article className={`${CARD_CLASS} group`}>
      <Link to={settingsHref} className={CARD_LINK_CLASS} aria-label={`Open ${model.title}`} />

      <div className="relative z-[2]">
        {imageUrls.length > 0 ? (
          <OrgPropertyImageCarousel
            images={imageUrls}
            name={model.title}
            className="rounded-t-xl"
            onSurfaceClick={() => navigate(settingsHref)}
          />
        ) : (
          <div className="bg-muted flex aspect-[4/3] items-center justify-center rounded-t-xl">
            <Landmark className="text-muted-foreground size-10" aria-hidden />
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 z-10">
          <DevelopmentStatusBadge status={development.status} />
        </div>
        <div className="absolute right-3 top-3 z-[3] opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <DevelopmentActionsMenu development={development} settingsHref={settingsHref} />
        </div>
      </div>

      <div className="relative z-[2] space-y-2.5 p-3 sm:p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-start gap-2">
            <Landmark className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <h3 className="text-foreground truncate text-sm font-semibold sm:text-base">
                {model.title}
              </h3>
              {model.subtitle ? (
                <p className="text-muted-foreground truncate text-xs sm:text-sm">
                  {model.subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <p className="text-muted-foreground text-xs">{model.typeLabel}</p>
        </div>

        <div className="text-muted-foreground text-xs">
          <span className="line-clamp-1">{model.locationLine}</span>
        </div>

        <div className="border-border/50 grid grid-cols-2 gap-2 border-t pt-2.5 text-center text-xs sm:text-sm">
          <div>
            <p className="text-muted-foreground text-[10px] sm:text-xs">Properties</p>
            <p className="font-semibold tabular-nums">{model.propertyCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] sm:text-xs">Parking</p>
            <p className="font-semibold tabular-nums">{model.parkingCount}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function SuperAdminDevelopmentListRow({ development }: Props) {
  const model = superAdminDevelopmentCardModel(development);
  const settingsHref = superAdminPaths.developmentDetail(development.slug);

  return (
    <article className="border-border/50 bg-card hover:border-primary/30 flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="bg-muted flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:size-16">
          {model.thumbnailUrl ? (
            <img
              src={model.thumbnailUrl}
              alt=""
              className="size-full object-cover"
              width={64}
              height={64}
            />
          ) : (
            <Landmark className="text-muted-foreground size-6" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold sm:text-base">{model.title}</h3>
            <DevelopmentStatusBadge status={development.status} />
          </div>
          {model.subtitle ? (
            <p className="text-muted-foreground truncate text-xs sm:text-sm">{model.subtitle}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {model.typeLabel} · {model.locationLine}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-muted-foreground flex gap-4 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5" aria-hidden />
            {model.propertyCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Car className="size-3.5" aria-hidden />
            {model.parkingCount}
          </span>
        </div>
        <Button asChild variant="outline" className="min-h-[44px]">
          <Link to={settingsHref}>Settings</Link>
        </Button>
      </div>
    </article>
  );
}

export function SuperAdminDevelopmentsEmptyState({
  filtered,
  onAdd,
}: {
  filtered: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="border-border/50 bg-card flex flex-col items-center justify-center rounded-xl border px-4 py-12 text-center">
      <Landmark className="text-muted-foreground mb-3 size-10" aria-hidden />
      <p className="text-foreground font-medium">
        {filtered ? 'No developments match your filters' : 'No developments yet'}
      </p>
      {!filtered ? (
        <Button type="button" className="mt-4 min-h-[44px]" onClick={onAdd}>
          Add development
        </Button>
      ) : null}
    </div>
  );
}
