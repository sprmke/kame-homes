import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addAssistantMemory,
  deleteAssistantMemory,
  fetchAssistantMemory,
  type AssistantMemory,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { useOrgScopeKey } from '@/features/dashboard/org/lib/adminApiScope';

const memoryKey = (orgSlug: string | null, orgId: string | null) =>
  ['org', orgSlug ?? orgId, 'ai-assistant-memory'] as const;

/** What the assistant remembers for this host (preferences) and org (house style). */
export function useAssistantMemory(enabled: boolean) {
  const { orgSlug, orgId } = useOrgScopeKey();
  return useQuery({
    queryKey: memoryKey(orgSlug, orgId),
    enabled: enabled && Boolean(orgSlug || orgId),
    queryFn: () => fetchAssistantMemory(orgSlug, orgId),
    // Only fetched while the dialog is open; refetch each open so preferences the assistant
    // saved mid-chat (remember_preference) show up.
    refetchOnMount: 'always',
  });
}

export function useAddAssistantMemory() {
  const queryClient = useQueryClient();
  const { orgSlug, orgId } = useOrgScopeKey();
  return useMutation({
    mutationFn: (input: { kind: 'preference' | 'house_style'; content: string }) =>
      addAssistantMemory(orgSlug, orgId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memoryKey(orgSlug, orgId) });
    },
  });
}

export function useDeleteAssistantMemory() {
  const queryClient = useQueryClient();
  const { orgSlug, orgId } = useOrgScopeKey();
  const key = memoryKey(orgSlug, orgId);
  return useMutation({
    mutationFn: (id: string) => deleteAssistantMemory(orgSlug, orgId, id),
    onMutate: (id) => {
      const previous = queryClient.getQueryData<AssistantMemory>(key);
      if (previous) {
        queryClient.setQueryData<AssistantMemory>(key, {
          ...previous,
          preferences: previous.preferences.filter((item) => item.id !== id),
          houseStyle: previous.houseStyle.filter((item) => item.id !== id),
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
