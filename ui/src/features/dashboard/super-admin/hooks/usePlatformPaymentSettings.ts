import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type PlatformPaymentSettings = {
  enabledPaymentMethods: string[];
  enabledBanks: string[];
  renewalLinkLeadDays: number;
  gracePeriodDays: number;
  updatedAt?: string;
};

const PAYMENT_SETTINGS_KEY = ['super-admin', 'platform-payment-settings'] as const;

export function usePlatformPaymentSettings() {
  return useQuery({
    queryKey: PAYMENT_SETTINGS_KEY,
    queryFn: () =>
      callEdgeFunction<{ settings: PlatformPaymentSettings }>('platform-payment-settings').then(
        (data) => data.settings
      ),
  });
}

export function useUpdatePlatformPaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PlatformPaymentSettings>) =>
      callEdgeFunction<{ settings: PlatformPaymentSettings }>('platform-payment-settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      }).then((data) => data.settings),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PAYMENT_SETTINGS_KEY });
      toast.success('Payment settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not save settings');
    },
  });
}

export function useRunPlatformBillingCron() {
  return useMutation({
    mutationFn: () =>
      callEdgeFunction<{ result: Record<string, number> }>('org-subscriptions-admin', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'run_billing_cron' }),
      }).then((data) => data.result),
    onSuccess: (result) => {
      toast.success(
        `Billing cron: ${result.renewalLinks ?? 0} renewals, ${result.pastDue ?? 0} past due, ${result.suspended ?? 0} suspended`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Cron failed');
    },
  });
}
