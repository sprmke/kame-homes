/**
 * Session lifecycle hooks for the identity flow.
 *
 * Desktop: create a session, then poll. Polling every 2s is the contract — Realtime
 * `postgres_changes` honours RLS and these tables deliberately have no anon read policy,
 * so a subscription would silently never fire in production.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelIdentitySession,
  createIdentitySession,
  fetchMyIdentity,
  getIdentitySession,
  submitIdentitySession,
  type CreateIdentitySessionInput,
  type CreatedIdentitySession,
  type IdentitySessionView,
  type IdentitySubmitPayload,
  type IdentitySubmitResponse,
  type MyIdentityResponse,
} from '../lib/identityApi';

const TERMINAL: ReadonlySet<IdentitySessionView['status']> = new Set([
  'completed',
  'failed',
  'expired',
]);

export const identitySessionQueryKey = (sessionId: string | null) =>
  ['identity-session', sessionId] as const;

export const myIdentityQueryKey = ['identity-verification-mine'] as const;

export function useMyIdentity(enabled = true) {
  return useQuery<MyIdentityResponse>({
    queryKey: myIdentityQueryKey,
    queryFn: fetchMyIdentity,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useCreateIdentitySession() {
  return useMutation<CreatedIdentitySession, Error, CreateIdentitySessionInput>({
    mutationFn: createIdentitySession,
  });
}

export function useCancelIdentitySession() {
  return useMutation<void, Error, string>({
    mutationFn: cancelIdentitySession,
  });
}

export function useSubmitIdentitySession() {
  const queryClient = useQueryClient();
  return useMutation<
    IdentitySubmitResponse,
    Error,
    { token: string; payload: IdentitySubmitPayload }
  >({
    mutationFn: ({ token, payload }) => submitIdentitySession(token, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myIdentityQueryKey });
    },
  });
}

/**
 * Poll one session. `refetchInterval` keeps running until the session is terminal, so a
 * desktop waiting on a phone advances on its own without a navigation.
 */
export function useIdentitySessionPolling(options: {
  token: string | null;
  sessionId: string | null;
  enabled?: boolean;
}) {
  const { token, sessionId, enabled = true } = options;

  return useQuery<IdentitySessionView>({
    queryKey: identitySessionQueryKey(sessionId),
    enabled: Boolean(token) && enabled,
    queryFn: () => getIdentitySession(token as string),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2_000;
      if (TERMINAL.has(data.status)) return false;
      // Back off after the first 30s so a guest who walked away does not burn requests.
      const age = Date.now() - Date.parse(data.expiresAt) + 10 * 60 * 1000;
      return age > 30_000 ? 5_000 : 2_000;
    },
    refetchIntervalInBackground: false,
  });
}

/** Read one session by token without polling (phone bootstrap). */
export function useIdentitySessionOnce(token: string | null) {
  return useQuery<IdentitySessionView>({
    queryKey: identitySessionQueryKey(token),
    enabled: Boolean(token),
    queryFn: () => getIdentitySession(token as string, { mobile: true }),
    staleTime: 0,
    retry: false,
  });
}
