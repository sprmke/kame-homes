import { Link } from 'react-router-dom';

import { Building2, Car } from 'lucide-react';

import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import type { HostOrganization } from '@/features/dashboard/super-admin/types/host';

import { cn } from '@/lib/utils';

const CARD_CLASS =
  'relative block rounded-xl border border-border/50 bg-card text-card-foreground shadow-card overflow-hidden transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-lg dark:border-[hsl(0_0%_100%_/_0.06)]';

type Props = {
  organization: HostOrganization;
};

export function SuperAdminHostOrgCard({ organization }: Props) {
  const href = superAdminPaths.organizationHub(organization.slug);

  return (
    <Link to={href} className={cn(CARD_CLASS, 'block p-4 sm:p-5')}>
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Building2 className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="text-foreground truncate text-sm font-semibold sm:text-base">
              {organization.name}
            </h3>
            <p className="text-muted-foreground truncate text-xs">{organization.slug}</p>
          </div>
          <div className="text-muted-foreground flex gap-4 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" aria-hidden />
              {organization.stats.propertyCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Car className="size-3.5" aria-hidden />
              {organization.stats.parkingCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function SuperAdminHostOrgsEmptyState() {
  return (
    <div className="border-border/50 bg-card flex flex-col items-center justify-center rounded-xl border px-4 py-8 sm:py-12 text-center">
      <Building2 className="text-muted-foreground mb-3 size-10" aria-hidden />
      <p className="text-foreground font-medium">No organizations</p>
    </div>
  );
}
