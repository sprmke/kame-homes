import { ExternalLink } from 'lucide-react';

import {
  orgPlansPath,
  orgSettingsPath,
  orgTeamPath,
} from '@/features/dashboard/org/lib/tenantPaths';
import { SuperAdminSettingsCard } from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import { useSuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';

import { Button } from '@/components/ui/button';

function ExternalLinkButton({ href, children }: { href: string; children: string }) {
  return (
    <Button type="button" variant="outline" className="min-h-[44px] justify-between gap-2" asChild>
      <a href={href} target="_blank" rel="noreferrer">
        {children}
        <ExternalLink className="size-4" aria-hidden />
      </a>
    </Button>
  );
}

export function SuperAdminOrgSettingsSection() {
  const { org, slug } = useSuperAdminOrgContext();

  return (
    <div className="space-y-3 sm:space-y-4">
      <SuperAdminSettingsCard
        title="Manage in the org dashboard"
        description="Team roles, org settings, and billing history are edited from the organization's own dashboard."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <ExternalLinkButton href={orgTeamPath(slug)}>Team & roles</ExternalLinkButton>
          <ExternalLinkButton href={orgSettingsPath(slug)}>
            Organization settings
          </ExternalLinkButton>
          <ExternalLinkButton href={orgPlansPath(slug)}>Plans & billing</ExternalLinkButton>
        </div>
      </SuperAdminSettingsCard>

      <SuperAdminSettingsCard
        title="Details"
        description="Read-only identity for support and audit."
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">Organization ID</dt>
            <dd className="break-all font-mono text-xs">{org.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Slug</dt>
            <dd>/{org.slug}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Owner</dt>
            <dd>
              {org.owner.name}
              {org.owner.email ? ` · ${org.owner.email}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Created</dt>
            <dd>{new Date(org.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </SuperAdminSettingsCard>
    </div>
  );
}
