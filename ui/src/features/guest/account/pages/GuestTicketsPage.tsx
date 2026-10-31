import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GUEST_ACCOUNT_PATH } from '@/features/guest/account/lib/guestAccountPaths';

import { SupportTicketScopeProvider } from '@/features/dashboard/help-support/context/SupportTicketScopeContext';
import { TicketsWorkspacePage } from '@/features/dashboard/help-support/pages/TicketsWorkspacePage';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

const GUEST_TICKET_SCOPE = {
  channel: 'guest' as const,
  orgSlug: null,
  orgId: null,
  propertyId: null,
  parkingId: null,
};

export function GuestTicketsPage() {
  usePageTitle(publicPageTitle('Tickets'));

  return (
    <GuestAccountContentCard
      className="flex h-[min(70vh,640px)] flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 sm:p-0"
    >
      <SupportTicketScopeProvider scope={GUEST_TICKET_SCOPE}>
        <TicketsWorkspacePage basePathOverride={GUEST_ACCOUNT_PATH} />
      </SupportTicketScopeProvider>
    </GuestAccountContentCard>
  );
}
