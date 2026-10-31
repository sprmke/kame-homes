import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type AiCreditLedgerEntry = {
  id: string;
  entryType: 'usage_debit' | 'purchase_credit' | 'manual_adjustment';
  creditsDelta: number;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type AiCreditWalletDto = {
  organizationId: string;
  organizationName: string;
  balanceCredits: number;
  ledger: AiCreditLedgerEntry[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts either an org UUID or an org slug, matching what the input field's placeholder promises. */
function orgQueryParam(orgQuery: string): string {
  const trimmed = orgQuery.trim();
  const key = UUID_RE.test(trimmed) ? 'org_id' : 'org_slug';
  return `${key}=${encodeURIComponent(trimmed)}`;
}

const walletKey = (orgQuery: string) =>
  ['super-admin', 'ai-platform-credit-wallet', orgQuery] as const;

export function useAiCreditWallet(orgQuery: string | null) {
  return useQuery({
    queryKey: walletKey(orgQuery ?? ''),
    enabled: Boolean(orgQuery),
    queryFn: () =>
      callEdgeFunction<AiCreditWalletDto>(`ai-platform-credit-wallet?${orgQueryParam(orgQuery!)}`),
  });
}

export function useAdjustAiCreditWallet(orgQuery: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { creditsDelta: number; description?: string }) =>
      callEdgeFunction<AiCreditWalletDto>(
        `ai-platform-credit-wallet?${orgQueryParam(orgQuery ?? '')}`,
        { method: 'POST', body: JSON.stringify(input) }
      ),
    onSuccess: (data) => {
      qc.setQueryData(walletKey(orgQuery ?? ''), data);
    },
  });
}
