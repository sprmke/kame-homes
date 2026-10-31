import { Link } from 'react-router-dom';

import { Building, Car, DollarSign, ExternalLink, Users } from 'lucide-react';

import { orgDashboardPath } from '@/features/dashboard/org/lib/tenantPaths';
import { useSuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function verificationLabel(status: string): string {
  if (status === 'approved' || status === 'verified') return 'Verified';
  if (status === 'pending') return 'In review';
  if (status === 'rejected') return 'Rejected';
  return 'Not submitted';
}

export function SuperAdminOrgOverviewSection() {
  const { org, slug } = useSuperAdminOrgContext();

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Properties"
          value={String(org.counts.properties)}
          to={superAdminPaths.organizationHubSection(slug, 'listings')}
          icon={Building}
          iconClassName="text-violet-600 dark:text-violet-400"
          iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
        />
        <StatCard
          title="Parkings"
          value={String(org.counts.parkings)}
          to={superAdminPaths.organizationHubSection(slug, 'listings')}
          icon={Car}
          iconClassName="text-amber-600 dark:text-amber-400"
          iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
        />
        <StatCard
          title="Team members"
          value={String(org.counts.members)}
          icon={Users}
          iconClassName="text-sky-600 dark:text-sky-400"
          iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
        />
        <StatCard
          title="MRR"
          value={org.plan ? `₱${org.plan.mrrPhp.toLocaleString('en-PH')}` : '₱0'}
          to={superAdminPaths.organizationHubSection(slug, 'subscription')}
          icon={DollarSign}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
        />
      </section>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Base</span>
              <Badge variant="outline">{verificationLabel(org.verification.baseStatus)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Enhanced</span>
              <Badge variant="outline">{verificationLabel(org.verification.enhancedStatus)}</Badge>
            </div>
            <Link
              to={superAdminPaths.organizationHubSection(slug, 'approvals')}
              className="text-primary inline-flex pt-1 text-sm font-medium hover:underline"
            >
              Review approvals
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending approvals</span>
              <span className="font-medium tabular-nums">{org.openWork.pendingApprovals}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Open tickets</span>
              <span className="font-medium tabular-nums">{org.openWork.openTickets}</span>
            </div>
            <a
              href={orgDashboardPath(slug)}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1 pt-1 text-sm font-medium hover:underline"
            >
              Open org dashboard
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
