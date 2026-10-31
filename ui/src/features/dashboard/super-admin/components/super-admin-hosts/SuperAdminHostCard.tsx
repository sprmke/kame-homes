import { Link } from 'react-router-dom';

import { Building2, Car, Mail, Users } from 'lucide-react';

import { hostDisplayInitial } from '@/features/dashboard/super-admin/lib/superAdminHostsFilters';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import type { HostSummary } from '@/features/dashboard/super-admin/types/host';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CARD_CLASS =
  'relative block cursor-pointer rounded-xl border border-border/50 bg-card text-card-foreground shadow-card overflow-hidden transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-lg dark:border-[hsl(0_0%_100%_/_0.06)]';

const CARD_LINK_CLASS =
  'absolute inset-0 z-[1] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

type Props = {
  host: HostSummary;
};

function HostAvatar({ host, className }: { host: HostSummary; className?: string }) {
  const initial = hostDisplayInitial(host.name, host.email);
  if (host.avatarUrl) {
    return (
      <img
        src={host.avatarUrl}
        alt=""
        className={cn('rounded-full object-cover', className)}
        width={48}
        height={48}
      />
    );
  }

  return (
    <div
      className={cn(
        'gradient-primary text-primary-foreground flex items-center justify-center rounded-full font-bold',
        className
      )}
    >
      {initial}
    </div>
  );
}

export function SuperAdminHostCard({ host }: Props) {
  const href = superAdminPaths.hostDetail(host.id);

  return (
    <article className={`${CARD_CLASS} group`}>
      <Link to={href} className={CARD_LINK_CLASS} aria-label={`Open ${host.name}`} />

      <div className="pointer-events-none relative z-[2] space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <HostAvatar host={host} className="size-12 shrink-0 text-lg" />
          <div className="min-w-0 flex-1">
            <h3 className="text-foreground truncate text-sm font-semibold sm:text-base">
              {host.name}
            </h3>
            {host.email ? (
              <p className="text-muted-foreground truncate text-xs sm:text-sm">{host.email}</p>
            ) : null}
          </div>
        </div>

        <div className="border-border/50 grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs sm:text-sm">
          <div>
            <p className="text-muted-foreground text-[10px] sm:text-xs">Orgs</p>
            <p className="font-semibold tabular-nums">{host.stats.organizationCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] sm:text-xs">Properties</p>
            <p className="font-semibold tabular-nums">{host.stats.propertyCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] sm:text-xs">Parking</p>
            <p className="font-semibold tabular-nums">{host.stats.parkingCount}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function SuperAdminHostListRow({ host }: Props) {
  const href = superAdminPaths.hostDetail(host.id);

  return (
    <article className="border-border/50 bg-card hover:border-primary/30 flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <HostAvatar host={host} className="size-12 shrink-0 text-base" />
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-sm font-semibold sm:text-base">{host.name}</h3>
          {host.email ? (
            <p className="text-muted-foreground flex items-center gap-1 truncate text-xs sm:text-sm">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              {host.email}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-muted-foreground flex gap-4 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5" aria-hidden />
            {host.stats.organizationCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {host.stats.propertyCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Car className="size-3.5" aria-hidden />
            {host.stats.parkingCount}
          </span>
        </div>
        <Button asChild variant="outline" className="min-h-[44px]">
          <Link to={href}>View</Link>
        </Button>
      </div>
    </article>
  );
}

export function SuperAdminHostsEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="border-border/50 bg-card flex flex-col items-center justify-center rounded-xl border px-4 py-8 sm:py-12 text-center">
      <Users className="text-muted-foreground mb-3 size-10" aria-hidden />
      <p className="text-foreground font-medium">
        {filtered ? 'No hosts match your search' : 'No hosts yet'}
      </p>
    </div>
  );
}
