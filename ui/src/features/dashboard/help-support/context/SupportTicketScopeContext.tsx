import { createContext, useContext, type ReactNode } from 'react';

import type { SupportTicketScopeParams } from '@/features/dashboard/help-support/lib/supportTicketApi';

const SupportTicketScopeContext = createContext<SupportTicketScopeParams | null>(null);

type Props = {
  scope: SupportTicketScopeParams;
  children: ReactNode;
};

/** Override org/property/parking scope for support tickets outside admin routes (e.g. public Contact). */
export function SupportTicketScopeProvider({ scope, children }: Props) {
  return (
    <SupportTicketScopeContext.Provider value={scope}>
      {children}
    </SupportTicketScopeContext.Provider>
  );
}

export function useSupportTicketScopeOverride(): SupportTicketScopeParams | null {
  return useContext(SupportTicketScopeContext);
}
