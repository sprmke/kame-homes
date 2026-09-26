import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { Navigate, useLocation, useParams } from 'react-router-dom';

import {
  BadgeCheck,
  Building2,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  ScrollText,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';

import {
  AdminSectionNavLayout,
  type AdminSectionNavItem,
} from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { orgDashboardPath } from '@/features/dashboard/org/lib/tenantPaths';
import { SuperAdminDetailHeader } from '@/features/dashboard/super-admin/components/shared/SuperAdminDetailHeader';
import { SuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';
import { useSuperAdminOrgDetail } from '@/features/dashboard/super-admin/hooks/useSuperAdminOrgs';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import { SuperAdminOrgActivitySection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgActivitySection';
import { SuperAdminOrgAiSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgAiSection';
import { SuperAdminOrgApprovalsSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgApprovalsSection';
import { SuperAdminOrgListingsSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgListingsSection';
import { SuperAdminOrgOverviewSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgOverviewSection';
import { SuperAdminOrgSettingsSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgSettingsSection';
import { SuperAdminOrgSubscriptionSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgSubscriptionSection';
import { SuperAdminOrgSupportSection } from '@/features/dashboard/super-admin/pages/SuperAdminOrgSupportSection';

import {
  AdminPageHeaderSkeleton,
  AppSettingsNavLayoutSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import { Badge } from '@/components/ui/badge';

import type { LucideIcon } from 'lucide-react';

const ORG_HUB_SECTIONS: AdminSectionNavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'listings', label: 'Listings', icon: Building2 },
  { id: 'approvals', label: 'Approvals', icon: BadgeCheck },
  { id: 'ai', label: 'AI credits', icon: Sparkles },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'activity', label: 'Activity', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/** One anchored block in the hub — heading matches the left nav, content is free-form. */
function HubSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div id={`section-${id}`} className="scroll-mt-2 space-y-3">
      <h2 className="text-section-title flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden />
        {title}
      </h2>
      {children}
    </div>
  );
}

export function SuperAdminOrgShell() {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const { data: org, isLoading, error } = useSuperAdminOrgDetail(orgSlug);

  // Deep links from other pages (Overview attention list, AI usage top-orgs, …) land here
  // with a `#section-x` hash — scroll to it once the section content has mounted.
  useEffect(() => {
    if (!org || !location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    const timer = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => clearTimeout(timer);
  }, [org, location.hash]);

  if (!orgSlug) {
    return <Navigate to={superAdminPaths.organizations} replace />;
  }
  if (isLoading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <AdminPageHeaderSkeleton compact card />
        <AppSettingsNavLayoutSkeleton />
      </div>
    );
  }
  if (error || !org) {
    return <p className="text-destructive text-sm">Organization not found.</p>;
  }

  const openWork = org.openWork.pendingApprovals + org.openWork.openTickets;

  return (
    <SuperAdminOrgContext.Provider value={{ org, slug: orgSlug }}>
      <AdminSectionNavLayout
        sections={ORG_HUB_SECTIONS}
        header={
          <SuperAdminDetailHeader
            backTo={{ to: superAdminPaths.organizations, label: 'Organizations' }}
            leading={
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Building2 className="size-5" aria-hidden />
              </div>
            }
            title={org.name}
            meta={
              <>
                {org.plan?.name ? (
                  <Badge variant="secondary">{org.plan.name}</Badge>
                ) : (
                  <Badge variant="outline">No plan</Badge>
                )}
                {openWork > 0 ? <Badge variant="outline">{openWork} open</Badge> : null}
              </>
            }
            details={
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                <a
                  href={orgDashboardPath(orgSlug)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                >
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />/{org.slug}
                </a>
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                  <UserRound className="size-3.5 shrink-0" aria-hidden />
                  {org.owner.name || org.owner.email || '-'}
                </span>
              </div>
            }
          />
        }
      >
        <HubSection id="overview" title="Overview" icon={LayoutDashboard}>
          <SuperAdminOrgOverviewSection />
        </HubSection>
        <HubSection id="subscription" title="Subscription" icon={CreditCard}>
          <SuperAdminOrgSubscriptionSection />
        </HubSection>
        <HubSection id="listings" title="Listings" icon={Building2}>
          <SuperAdminOrgListingsSection />
        </HubSection>
        <HubSection id="approvals" title="Approvals" icon={BadgeCheck}>
          <SuperAdminOrgApprovalsSection />
        </HubSection>
        <HubSection id="ai" title="AI credits" icon={Sparkles}>
          <SuperAdminOrgAiSection />
        </HubSection>
        <HubSection id="support" title="Support" icon={LifeBuoy}>
          <SuperAdminOrgSupportSection />
        </HubSection>
        <HubSection id="activity" title="Activity" icon={ScrollText}>
          <SuperAdminOrgActivitySection />
        </HubSection>
        <HubSection id="settings" title="Settings" icon={Settings}>
          <SuperAdminOrgSettingsSection />
        </HubSection>
      </AdminSectionNavLayout>
    </SuperAdminOrgContext.Provider>
  );
}
