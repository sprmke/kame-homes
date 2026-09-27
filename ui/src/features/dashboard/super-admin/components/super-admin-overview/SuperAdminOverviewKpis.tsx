import {
  BadgeCheck,
  Building,
  Building2,
  Car,
  LifeBuoy,
  Receipt,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

import type { SuperAdminOverview } from '@/features/dashboard/super-admin/hooks/useSuperAdminOverview';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { StatCard } from '@/components/shared/StatCard';

function formatPhpCompact(value: number): string {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(0)}k`;
  return `₱${value.toLocaleString('en-PH')}`;
}

export function SuperAdminOverviewKpis({ kpis }: { kpis: SuperAdminOverview['kpis'] }) {
  return (
    <section
      aria-label="Platform metrics"
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:gap-4"
    >
      <StatCard
        title="Organizations"
        value={String(kpis.organizations)}
        icon={Building2}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <StatCard
        title="Live subscriptions"
        value={String(kpis.liveSubscriptions)}
        to={superAdminPaths.propertySubscriptions}
        icon={Receipt}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
        footer={`${formatPhpCompact(kpis.mrrPhp)} MRR`}
      />
      <StatCard
        title="Hosts"
        value={String(kpis.hosts)}
        to={superAdminPaths.hosts}
        icon={Users}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
      />
      <StatCard
        title="Properties"
        value={String(kpis.properties)}
        to={superAdminPaths.properties}
        icon={Building}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
      <StatCard
        title="Parkings"
        value={String(kpis.parkings)}
        icon={Car}
        iconClassName="text-orange-600 dark:text-orange-400"
        iconBgClassName="bg-orange-100 dark:bg-orange-900/30"
      />
      <StatCard
        title="Pending approvals"
        value={String(kpis.pendingApprovals)}
        to={superAdminPaths.approvals}
        icon={BadgeCheck}
        iconClassName="text-rose-600 dark:text-rose-400"
        iconBgClassName="bg-rose-100 dark:bg-rose-900/30"
      />
      <StatCard
        title="Open tickets"
        value={String(kpis.openTickets)}
        to={superAdminPaths.support}
        icon={LifeBuoy}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <StatCard
        title="AI spend"
        value={`$${kpis.aiSpendUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
        to={superAdminPaths.aiTab('usage')}
        icon={Sparkles}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
        footer="selected range"
      />
      <StatCard
        title="Undisbursed payouts"
        value={String(kpis.undisbursedParkingPayouts)}
        to={superAdminPaths.parkingPayouts}
        icon={Wallet}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
    </section>
  );
}
