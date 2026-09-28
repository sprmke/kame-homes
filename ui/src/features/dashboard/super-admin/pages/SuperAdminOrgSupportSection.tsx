import { useState } from 'react';

import { LifeBuoy } from 'lucide-react';

import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { useSuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';
import { SuperAdminSupportCardGrid } from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminSupportCardGrid';
import { SuperAdminTicketDetailDialog } from '@/features/dashboard/super-admin/components/super-admin-support/SuperAdminTicketDetailDialog';
import { useSupportTicketsAdmin } from '@/features/dashboard/super-admin/hooks/useSupportTicketsAdmin';

import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';

export function SuperAdminOrgSupportSection() {
  const { org } = useSuperAdminOrgContext();
  const { data, isLoading, error } = useSupportTicketsAdmin(
    { search: null, category: null, status: null, orgId: org.id },
    1,
    100
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const tickets = data?.tickets ?? [];

  if (isLoading) return <SuperAdminAdminListBodySkeleton metricCount={0} />;
  if (error) return <p className="text-destructive text-sm">Could not load support tickets.</p>;

  return (
    <div className="space-y-3 sm:space-y-4">
      {tickets.length === 0 ? (
        <SuperAdminEmptyState icon={LifeBuoy} title="No support tickets from this organization" />
      ) : (
        <SuperAdminSupportCardGrid tickets={tickets} onSelect={setSelectedTicketId} />
      )}
      <SuperAdminTicketDetailDialog
        ticketId={selectedTicketId}
        onOpenChange={(open) => {
          if (!open) setSelectedTicketId(null);
        }}
      />
    </div>
  );
}
