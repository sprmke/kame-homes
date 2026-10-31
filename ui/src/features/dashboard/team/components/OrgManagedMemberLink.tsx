import { Link } from 'react-router-dom';

import { ArrowUpRight, Building2 } from 'lucide-react';

import { orgTeamPath } from '@/features/dashboard/org/lib/tenantPaths';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { hasOrgPermission } from '@/features/dashboard/team/lib/orgPermissions';

import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

type Props = {
  orgSlug: string;
  /** `button` — outline CTA (desktop). `menuItem` — row inside a mobile … menu. */
  variant?: 'button' | 'menuItem';
};

export function useCanOpenOrgTeam(): boolean {
  const { data } = useOrgPermissions();
  return hasOrgPermission(data?.permissions, 'org:team:view');
}

export function OrgManagedMemberLink({ orgSlug, variant = 'button' }: Props) {
  const canViewOrgTeam = useCanOpenOrgTeam();

  if (!canViewOrgTeam) {
    return null;
  }

  const to = orgTeamPath(orgSlug);

  if (variant === 'menuItem') {
    return (
      <DropdownMenuItem asChild>
        <Link to={to} className="gap-2">
          <Building2 className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">Manage in org</span>
          <ArrowUpRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </Link>
      </DropdownMenuItem>
    );
  }

  return (
    <Button variant="outline" size="sm" className="min-h-[44px] gap-1.5 sm:min-h-9" asChild>
      <Link to={to}>
        <Building2 className="size-3.5 shrink-0" aria-hidden />
        <span>Manage in org</span>
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
      </Link>
    </Button>
  );
}
