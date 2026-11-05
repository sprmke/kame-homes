import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  MARKETING_AI_SESSIONS_QUERY_KEY,
  MARKETING_GENERATIONS_QUERY_KEY,
  generationFetch,
  handleGenerationError,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationApi';
import type {
  AiPostVersionRecord,
  AiSessionDetail,
  AiSessionRecord,
  AiSessionSummary,
} from '@/features/dashboard/marketing/lib/aiStudioSessions';
import {
  isGenerationInFlight,
  isStuckMarketingGeneration,
} from '@/features/dashboard/marketing/lib/marketingGenerationProgress';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

/**
 * AI Studio conversations (`marketing-ai-sessions`). Photo / clip versions are created
 * by `generate-marketing-media`; post versions are saved here after they render.
 */

const FN = 'marketing-ai-sessions';
const PAGE_SIZE = 24;
/** Photos finish inline, so only clips are ever polled here. */
const CLIP_POLL_MS = 3000;

export type AiSessionListFilters = {
  output: AiStudioOutput | null;
  query: string;
  deleted: boolean;
};

type ListPage = {
  items: AiSessionSummary[];
  nextCursor: string | null;
  allowPremiumImage?: boolean;
  allowPremiumVideo?: boolean;
};

function url(propertyId: string | null, params?: URLSearchParams): string {
  const base = scopedFunctionsUrl(FN, propertyId);
  if (!params || [...params.keys()].length === 0) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const aiSessionKeys = {
  all: (propertyId: string | null) => [MARKETING_AI_SESSIONS_QUERY_KEY, propertyId] as const,
  list: (propertyId: string | null, filters: AiSessionListFilters) =>
    [MARKETING_AI_SESSIONS_QUERY_KEY, propertyId, 'list', filters] as const,
  detail: (propertyId: string | null, id: string | null) =>
    [MARKETING_AI_SESSIONS_QUERY_KEY, propertyId, 'detail', id] as const,
};

export function useAiSessionList(filters: AiSessionListFilters, enabled = true) {
  const propertyId = usePropertyIdParam();
  return useInfiniteQuery({
    queryKey: aiSessionKeys.list(propertyId, filters),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (filters.output) params.set('output', filters.output);
      if (filters.query.trim()) params.set('q', filters.query.trim());
      if (filters.deleted) params.set('deleted', '1');
      if (pageParam) params.set('cursor', pageParam);
      const page = await generationFetch<Partial<ListPage>>(url(propertyId, params));
      // A page without items would break the grid and the poll check.
      return {
        ...page,
        items: Array.isArray(page?.items) ? page.items : [],
        nextCursor: page?.nextCursor ?? null,
      } satisfies ListPage;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    // A clip still rendering on the home grid: refresh until it lands.
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) => page.items.some((item) => item.inFlight))
        ? 5000
        : false,
    staleTime: 15_000,
    enabled,
  });
}

export function useAiSession(id: string | null) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: aiSessionKeys.detail(propertyId, id),
    queryFn: async () => {
      const detail = await generationFetch<AiSessionDetail>(
        url(propertyId, new URLSearchParams({ id: id! }))
      );
      return {
        ...detail,
        jobs: Array.isArray(detail?.jobs) ? detail.jobs : [],
        postVersions: Array.isArray(detail?.postVersions) ? detail.postVersions : [],
      };
    },
    enabled: Boolean(id),
    retry: (count, error) => !/not found/i.test(error.message) && count < 2,
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      const active = jobs.filter((job) => isGenerationInFlight(job));
      if (active.length === 0) return false;
      if (active.every((job) => isStuckMarketingGeneration(job))) return false;
      return CLIP_POLL_MS;
    },
    refetchIntervalInBackground: true,
    staleTime: 5_000,
  });
}

export function seedAiSession(
  qc: QueryClient,
  propertyId: string | null,
  id: string,
  update: (current: AiSessionDetail | undefined) => AiSessionDetail | undefined
) {
  qc.setQueryData<AiSessionDetail | undefined>(aiSessionKeys.detail(propertyId, id), update);
}

function refreshLists(qc: QueryClient, propertyId: string | null) {
  void qc.invalidateQueries({
    queryKey: [MARKETING_AI_SESSIONS_QUERY_KEY, propertyId, 'list'],
  });
}

export type SavePostVersionsInput = {
  sessionId: string | null;
  prompt: string | null;
  title?: string;
  themeKey?: string | null;
  parentVersionId?: string | null;
  versions: Array<{
    spec: Record<string, unknown>;
    goal: string;
    format: string;
    photoUrls: string[];
    previewDataUrl: string | null;
  }>;
};

export function useSavePostVersions() {
  const propertyId = usePropertyIdParam();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavePostVersionsInput) =>
      generationFetch<{ session: AiSessionRecord; versions: AiPostVersionRecord[] }>(
        url(propertyId),
        jsonInit('POST', { action: 'post-versions', ...input }),
        'aiMarketingGeneration'
      ),
    onSuccess: ({ session, versions }) => {
      seedAiSession(qc, propertyId, session.id, (current) => ({
        session,
        jobs: current?.jobs ?? [],
        postVersions: [
          ...(current?.postVersions ?? []).filter(
            (row) => !versions.some((next) => next.id === row.id)
          ),
          ...versions,
        ],
      }));
      refreshLists(qc, propertyId);
    },
    onError: (error: Error) => handleGenerationError(error),
  });
}

export function useRenameAiSession() {
  const propertyId = usePropertyIdParam();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; title: string }) =>
      generationFetch<{ session: AiSessionRecord }>(url(propertyId), jsonInit('PATCH', input)),
    onMutate: ({ id, title }) => {
      seedAiSession(qc, propertyId, id, (current) =>
        current ? { ...current, session: { ...current.session, title } } : current
      );
    },
    onSuccess: ({ session }) => {
      seedAiSession(qc, propertyId, session.id, (current) =>
        current ? { ...current, session } : current
      );
      refreshLists(qc, propertyId);
    },
    onError: (error: Error, { id }) => {
      toast.error(error.message || 'Could not rename');
      void qc.invalidateQueries({ queryKey: aiSessionKeys.detail(propertyId, id) });
    },
  });
}

export function useRestoreAiSessions() {
  const propertyId = usePropertyIdParam();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      generationFetch<{ restored: string[] }>(
        url(propertyId),
        jsonInit('POST', { action: 'restore', ids })
      ),
    onSuccess: ({ restored }) => {
      toast.success(restored.length === 1 ? 'Restored' : `${restored.length} restored`);
      void qc.invalidateQueries({ queryKey: aiSessionKeys.all(propertyId) });
    },
    onError: (error: Error) => toast.error(error.message || 'Could not restore'),
  });
}

/** Soft delete shows Undo; delete forever confirms first (caller) and has no Undo. */
export function useDeleteAiSessions() {
  const propertyId = usePropertyIdParam();
  const qc = useQueryClient();
  const restore = useRestoreAiSessions();
  return useMutation({
    mutationFn: (input: { ids: string[]; permanent?: boolean }) =>
      generationFetch<{ deleted: string[]; permanent: boolean }>(
        url(propertyId),
        jsonInit('DELETE', input)
      ),
    onSuccess: ({ deleted, permanent }) => {
      void qc.invalidateQueries({ queryKey: aiSessionKeys.all(propertyId) });
      void qc.invalidateQueries({ queryKey: [MARKETING_GENERATIONS_QUERY_KEY, propertyId] });
      if (permanent) {
        toast.success('Deleted forever');
        return;
      }
      toast.success(
        deleted.length === 1
          ? 'Moved to Recently deleted'
          : `${deleted.length} moved to Recently deleted`,
        {
          action: { label: 'Undo', onClick: () => restore.mutate(deleted) },
        }
      );
    },
    onError: (error: Error) => toast.error(error.message || 'Could not delete'),
  });
}

/** One version inside a conversation (post version here, photo / clip job elsewhere). */
export function useDeleteAiVersion(sessionId: string | null) {
  const propertyId = usePropertyIdParam();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version: { kind: 'post' | 'image' | 'video'; id: string }) => {
      if (version.kind === 'post') {
        await generationFetch(url(propertyId), jsonInit('DELETE', { postVersionId: version.id }));
        return version;
      }
      await generationFetch(
        scopedFunctionsUrl('marketing-generations', propertyId),
        jsonInit('DELETE', { jobId: version.id })
      );
      return version;
    },
    onSuccess: (version) => {
      if (sessionId) {
        seedAiSession(qc, propertyId, sessionId, (current) =>
          current
            ? {
                ...current,
                jobs: current.jobs.filter((job) => job.id !== version.id),
                postVersions: current.postVersions.filter((row) => row.id !== version.id),
              }
            : current
        );
      }
      refreshLists(qc, propertyId);
      toast.success('Version deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not delete that version'),
  });
}

const FLAGS_FILTERS: AiSessionListFilters = { output: null, query: '', deleted: false };

/** Premium quality switches (per property), read from the AI Studio home list. */
export function useAiPremiumFlags() {
  const list = useAiSessionList(FLAGS_FILTERS);
  const first = list.data?.pages[0];
  return {
    allowPremiumImage: Boolean(first?.allowPremiumImage),
    allowPremiumVideo: Boolean(first?.allowPremiumVideo),
  };
}
