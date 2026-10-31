import { useCallback, useEffect, useRef } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Organization } from '@/features/dashboard/org/types';
import {
  mergeSetupGuidePersistedState,
  type SetupGuideStatePatch,
} from '@/features/dashboard/setup-guide/lib/setupGuideState';
import {
  EMPTY_SETUP_GUIDE_STATE,
  type SetupGuidePersistedState,
} from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

const LAST_STEP_DEBOUNCE_MS = 400;

type SetupGuideStateWriteResult = {
  setupGuide: SetupGuidePersistedState;
};

type WriteArgs = {
  orgId: string;
  patch: SetupGuideStatePatch;
};

function applySetupGuideToOrganizationsCache(
  old: { organizations: Organization[] } | undefined,
  orgId: string,
  setupGuide: SetupGuidePersistedState
): { organizations: Organization[] } | undefined {
  if (!old) return old;
  return {
    organizations: old.organizations.map((organization) => {
      if (organization.id !== orgId) return organization;
      return {
        ...organization,
        settings: {
          ...organization.settings,
          setupGuide,
        },
      };
    }),
  };
}

function readCachedSetupGuide(
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: string
): SetupGuidePersistedState {
  const cached = queryClient.getQueryData<{ organizations: Organization[] }>(
    ORGANIZATIONS_QUERY_KEY
  );
  const org = cached?.organizations.find((entry) => entry.id === orgId);
  const raw = org?.settings?.setupGuide;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_SETUP_GUIDE_STATE };
  }
  return mergeSetupGuidePersistedState(EMPTY_SETUP_GUIDE_STATE, raw as SetupGuideStatePatch);
}

/**
 * Persists Setup Guide meta via `setup-guide-state`.
 * `lastStepId` is debounced; dismiss / complete / skip / review write immediately.
 */
export function useSetupGuideStateWrite(orgId: string | null | undefined) {
  const queryClient = useQueryClient();
  const lastStepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLastStepRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ orgId: id, patch }: WriteArgs) =>
      callEdgeFunction<SetupGuideStateWriteResult>('setup-guide-state', {
        method: 'PATCH',
        body: JSON.stringify({ orgId: id, patch }),
      }),
    onMutate: async ({ orgId: id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<{ organizations: Organization[] }>(
        ORGANIZATIONS_QUERY_KEY
      );
      const current = readCachedSetupGuide(queryClient, id);
      const next = mergeSetupGuidePersistedState(current, patch);
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, (old) =>
        applySetupGuideToOrganizationsCache(
          old as { organizations: Organization[] } | undefined,
          id,
          next
        )
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, context.previous);
      }
    },
    onSuccess: (data, { orgId: id }) => {
      const setupGuide = mergeSetupGuidePersistedState(
        EMPTY_SETUP_GUIDE_STATE,
        data.setupGuide as SetupGuideStatePatch
      );
      queryClient.setQueryData(ORGANIZATIONS_QUERY_KEY, (old) =>
        applySetupGuideToOrganizationsCache(
          old as { organizations: Organization[] } | undefined,
          id,
          setupGuide
        )
      );
    },
    // No invalidateQueries — optimistic + onSuccess keep the cache coherent without
    // refetch storms while hosts move between Setup Guide steps.
  });

  const writeNow = useCallback(
    (patch: SetupGuideStatePatch) => {
      if (!orgId) return Promise.resolve();
      return mutation.mutateAsync({ orgId, patch });
    },
    [mutation, orgId]
  );

  const setLastStepId = useCallback(
    (lastStepId: string | null) => {
      if (!orgId) return;
      pendingLastStepRef.current = lastStepId;
      if (lastStepTimerRef.current) clearTimeout(lastStepTimerRef.current);
      lastStepTimerRef.current = setTimeout(() => {
        lastStepTimerRef.current = null;
        const next = pendingLastStepRef.current;
        void writeNow({ lastStepId: next });
      }, LAST_STEP_DEBOUNCE_MS);
    },
    [orgId, writeNow]
  );

  const flushLastStepId = useCallback(async () => {
    if (!orgId) return;
    if (lastStepTimerRef.current) {
      clearTimeout(lastStepTimerRef.current);
      lastStepTimerRef.current = null;
    }
    if (pendingLastStepRef.current === undefined) return;
    const next = pendingLastStepRef.current;
    pendingLastStepRef.current = null;
    await writeNow({ lastStepId: next });
  }, [orgId, writeNow]);

  useEffect(() => {
    return () => {
      if (lastStepTimerRef.current) clearTimeout(lastStepTimerRef.current);
    };
  }, []);

  return {
    writeNow,
    setLastStepId,
    flushLastStepId,
    dismiss: (dismissedAt = new Date().toISOString()) => writeNow({ dismissedAt }),
    complete: (completedAt = new Date().toISOString()) => writeNow({ completedAt }),
    setSkippedSteps: (skippedSteps: string[]) => writeNow({ skippedSteps }),
    setReviewedSteps: (reviewedSteps: string[]) => writeNow({ reviewedSteps }),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
