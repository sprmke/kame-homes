import {
  BadgeCheck,
  Building,
  Building2,
  Car,
  Landmark,
  CreditCard,
  LifeBuoy,
  Receipt,
  Sparkles,
  Timer,
  Users,
  Wallet,
} from 'lucide-react';

import type { SuperAdminOverview } from '@/features/dashboard/super-admin/hooks/useSuperAdminOverview';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { StatCard, StatCardGrid } from '@/components/shared/StatCard';

type Props = {
  kpis: SuperAdminOverview['kpis'];
  orgsWithoutLivePlan: number;
};

export function SuperAdminOverviewKpis({ kpis, orgsWithoutLivePlan }: Props) {
  return (
    <section aria-label="Platform metrics">
      <StatCardGrid className="gap-2 sm:gap-2.5 md:grid-cols-4 lg:gap-3">
        <StatCard
          density="compact"
          title="Organizations"
          value={String(kpis.organizations)}
          icon={Building2}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
        />
        <StatCard
          density="compact"
          title="Live subscriptions"
          value={String(kpis.liveSubscriptions)}
          to={superAdminPaths.propertySubscriptions}
          icon={Receipt}
          iconClassName="text-sky-600 dark:text-sky-400"
          iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
        />
        <StatCard
          density="compact"
          title="Hosts"
          value={String(kpis.hosts)}
          to={superAdminPaths.hosts}
          icon={Users}
          iconClassName="text-violet-600 dark:text-violet-400"
          iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
        />
        <StatCard
          density="compact"
          title="Properties"
          value={String(kpis.properties)}
          to={superAdminPaths.properties}
          icon={Building}
          iconClassName="text-amber-600 dark:text-amber-400"
          iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
        />
        <StatCard
          density="compact"
          title="Developments"
          value={String(kpis.developments ?? 0)}
          to={superAdminPaths.developments}
          icon={Landmark}
          iconClassName="text-teal-600 dark:text-teal-400"
          iconBgClassName="bg-teal-100 dark:bg-teal-900/30"
        />
        <StatCard
          density="compact"
          title="Parkings"
          value={String(kpis.parkings)}
          icon={Car}
          iconClassName="text-orange-600 dark:text-orange-400"
          iconBgClassName="bg-orange-100 dark:bg-orange-900/30"
        />
        <StatCard
          density="compact"
          title="Pending approvals"
          value={String(kpis.pendingApprovals)}
          to={superAdminPaths.approvals}
          icon={BadgeCheck}
          iconClassName="text-rose-600 dark:text-rose-400"
          iconBgClassName="bg-rose-100 dark:bg-rose-900/30"
        />
        <StatCard
          density="compact"
          title="Open tickets"
          value={String(kpis.openTickets)}
          to={superAdminPaths.support}
          icon={LifeBuoy}
          iconClassName="text-sky-600 dark:text-sky-400"
          iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
        />
        <StatCard
          density="compact"
          title="AI spend"
          value={`$${kpis.aiSpendUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          to={superAdminPaths.aiTab('usage')}
          icon={Sparkles}
          iconClassName="text-violet-600 dark:text-violet-400"
          iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
        />
        <StatCard
          density="compact"
          title="Undisbursed payouts"
          value={String(kpis.undisbursedParkingPayouts)}
          to={superAdminPaths.parkingPayouts}
          icon={Wallet}
          iconClassName="text-amber-600 dark:text-amber-400"
          iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
        />
        <StatCard
          density="compact"
          title="Orgs without plan"
          value={String(orgsWithoutLivePlan)}
          to={superAdminPaths.propertySubscriptions}
          icon={CreditCard}
          iconClassName="text-slate-600 dark:text-slate-400"
          iconBgClassName="bg-slate-100 dark:bg-slate-900/30"
        />
        <StatCard
          density="compact"
          title="Trialing subs"
          value={String(kpis.trialingSubscriptions ?? 0)}
          to={superAdminPaths.propertySubscriptions}
          icon={Timer}
          iconClassName="text-indigo-600 dark:text-indigo-400"
          iconBgClassName="bg-indigo-100 dark:bg-indigo-900/30"
        />
      </StatCardGrid>
    </section>
  );
}
