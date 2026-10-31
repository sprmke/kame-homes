import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import {
  deleteAiAssistantConversation,
  fetchAiAssistantConversations,
  updateAiAssistantConversation,
  type AiAssistantConversationPage,
  type AiAssistantConversationSummary,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { useOrgScopeKey } from '@/features/dashboard/org/lib/adminApiScope';

export function aiAssistantConversationsQueryKey(orgSlug: string | null, orgId: string | null) {
  return ['org', orgSlug ?? orgId, 'ai-assistant-conversations'] as const;
}

type ConversationFilters = { q?: string; archived?: boolean };

export function useAiAssistantConversations(enabled: boolean, filters: ConversationFilters = {}) {
  const { orgSlug, orgId } = useOrgScopeKey();
  const q = filters.q?.trim() ?? '';
  const archived = Boolean(filters.archived);
  const query = useInfiniteQuery({
    queryKey: [...aiAssistantConversationsQueryKey(orgSlug, orgId), { q, archived }],
    enabled: enabled && Boolean(orgSlug || orgId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchAiAssistantConversations(orgSlug, orgId, { offset: pageParam, q, archived }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    staleTime: 15_000,
  });
  const conversations = query.data?.pages.flatMap((page) => page.conversations) ?? [];
  return { ...query, conversations };
}

type Pages = InfiniteData<AiAssistantConversationPage, number>;

/** Applies `update` to every cached list page (all filter variants) and returns a rollback. */
function patchCachedConversations(
  queryClient: ReturnType<typeof useQueryClient>,
  prefix: readonly unknown[],
  update: (rows: AiAssistantConversationSummary[]) => AiAssistantConversationSummary[]
): () => void {
  const snapshots = queryClient.getQueriesData<Pages>({ queryKey: prefix });
  for (const [key, data] of snapshots) {
    if (!data) continue;
    queryClient.setQueryData<Pages>(key, {
      ...data,
      pages: data.pages.map((page) => ({ ...page, conversations: update(page.conversations) })),
    });
  }
  return () => {
    for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
  };
}

export function useDeleteAiAssistantConversation() {
  const queryClient = useQueryClient();
  const { orgSlug, orgId } = useOrgScopeKey();
  const prefix = aiAssistantConversationsQueryKey(orgSlug, orgId);

  return useMutation({
    mutationFn: (conversationId: string) => deleteAiAssistantConversation(conversationId),
    onMutate: (conversationId) => ({
      rollback: patchCachedConversations(queryClient, prefix, (rows) =>
        rows.filter((row) => row.id !== conversationId)
      ),
    }),
    onError: (_err, _id, context) => context?.rollback(),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: prefix });
    },
  });
}

export type ConversationUpdate = { title?: string; pinned?: boolean; archived?: boolean };

export function useUpdateAiAssistantConversation() {
  const queryClient = useQueryClient();
  const { orgSlug, orgId } = useOrgScopeKey();
  const prefix = aiAssistantConversationsQueryKey(orgSlug, orgId);

  return useMutation({
    mutationFn: (input: { conversationId: string; patch: ConversationUpdate }) =>
      updateAiAssistantConversation(input.conversationId, input.patch),
    onMutate: ({ conversationId, patch }) => {
      const now = new Date().toISOString();
      return {
        rollback: patchCachedConversations(queryClient, prefix, (rows) =>
          rows.flatMap((row) => {
            if (row.id !== conversationId) return [row];
            // Archived rows leave the active list right away (and vice versa on restore).
            if (patch.archived !== undefined) return [];
            return [
              {
                ...row,
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.pinned !== undefined ? { pinned_at: patch.pinned ? now : null } : {}),
              },
            ];
          })
        ),
      };
    },
    onError: (_err, _input, context) => context?.rollback(),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: prefix });
    },
  });
}
