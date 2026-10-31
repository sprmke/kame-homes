import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type SuperAdminRateLimitCounter = {
  scope: string;
  identity: string;
  windowStart: string;
  count: number;
  limit: number;
  overLimit: boolean;
};

export type SuperAdminRateLimitBlock = {
  id: string;
  identity: string;
  reason: string | null;
  blockedBy: string | null;
  blockedAt: string;
  expiresAt: string | null;
};

export type SuperAdminRateLimits = {
  enforceEnabled: boolean;
  limit: number;
  activeCounters: SuperAdminRateLimitCounter[];
  blocks: SuperAdminRateLimitBlock[];
};

const KEY = ['super-admin', 'rate-limits'] as const;

export function useSuperAdminRateLimits() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => callEdgeFunction<SuperAdminRateLimits>('super-admin-rate-limits'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useBlockRateLimitIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { identity: string; reason?: string }) =>
      callEdgeFunction('super-admin-rate-limits', {
        method: 'POST',
        body: JSON.stringify({ action: 'block', ...input }),
      }),
    onSuccess: async (_data, input) => {
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success(`Blocked ${input.identity}`);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not block identity'),
  });
}

export function useUnblockRateLimitIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (identity: string) =>
      callEdgeFunction('super-admin-rate-limits', {
        method: 'POST',
        body: JSON.stringify({ action: 'unblock', identity }),
      }),
    onSuccess: async (_data, identity) => {
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success(`Unblocked ${identity}`);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not unblock identity'),
  });
}
