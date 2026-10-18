import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { usePropertyIdParam, scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type MarketingThemeSource = 'custom' | 'starter' | 'photos' | 'duplicate' | 'ai';

export type MarketingThemeRecord = {
  id: string;
  name: string;
  /** Raw from the server; parse with `coerceMarketingThemeTokens` before use. */
  tokens: unknown;
  source: MarketingThemeSource;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingThemesResponse = {
  themes: MarketingThemeRecord[];
  /** Saved items per theme key (built-in keys included; legacy rows count as Property colors). */
  itemCounts: Record<string, number>;
};

export class MarketingThemeConflictError extends Error {
  constructor(
    message: string,
    readonly itemCount: number
  ) {
    super(message);
    this.name = 'MarketingThemeConflictError';
  }
}

export function marketingThemesQueryKey(propertyId: string | null) {
  return ['marketing-themes', propertyId] as const;
}

async function themesRequest<T>(
  propertyId: string | null,
  init: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown }
): Promise<T> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('marketing-themes', propertyId), {
    method: init.method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    data?: T;
    itemCount?: number;
  };
  if (res.status === 409 && typeof json.itemCount === 'number') {
    throw new MarketingThemeConflictError(json.error ?? 'Theme is in use', json.itemCount);
  }
  if (!res.ok || !json.success) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

export function useMarketingThemes() {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: marketingThemesQueryKey(propertyId),
    queryFn: () => themesRequest<MarketingThemesResponse>(propertyId, { method: 'GET' }),
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  });
}

export type CreateMarketingThemeInput = {
  name: string;
  tokens: MarketingThemeTokens;
  source: MarketingThemeSource;
  sourceRef?: string | null;
};

export type UpdateMarketingThemeInput = {
  id: string;
  name?: string;
  tokens?: MarketingThemeTokens;
};

export type DeleteMarketingThemeInput = { id: string; moveTo?: string };

/** Create / update / delete. Each write refreshes themes and (on delete) saved items. */
export function useMarketingThemeMutations() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const invalidate = (withTemplates = false) => {
    void queryClient.invalidateQueries({ queryKey: marketingThemesQueryKey(propertyId) });
    if (withTemplates) {
      void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
    }
  };

  // Write the saved row into the cache before invalidating, so a caller that opens
  // the new theme right away finds it (no "theme not found" fallback while refetching).
  const upsertCached = (record: MarketingThemeRecord) => {
    queryClient.setQueryData<MarketingThemesResponse>(
      marketingThemesQueryKey(propertyId),
      (current) => {
        const themes = current?.themes ?? [];
        const exists = themes.some((theme) => theme.id === record.id);
        return {
          itemCounts: current?.itemCounts ?? {},
          themes: exists
            ? themes.map((theme) => (theme.id === record.id ? record : theme))
            : [...themes, record],
        };
      }
    );
  };

  const create = useMutation({
    mutationFn: (input: CreateMarketingThemeInput) =>
      themesRequest<MarketingThemeRecord>(propertyId, { method: 'POST', body: input }),
    onSuccess: (record) => {
      upsertCached(record);
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: (input: UpdateMarketingThemeInput) =>
      themesRequest<MarketingThemeRecord>(propertyId, { method: 'PATCH', body: input }),
    onSuccess: (record) => {
      upsertCached(record);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (input: DeleteMarketingThemeInput) =>
      themesRequest<{ deleted: boolean; movedItems: number }>(propertyId, {
        method: 'DELETE',
        body: input,
      }),
    onSuccess: () => invalidate(true),
  });

  return { create, update, remove };
}
