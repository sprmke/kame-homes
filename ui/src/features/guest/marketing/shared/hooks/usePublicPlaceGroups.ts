import { useInfiniteQuery } from '@tanstack/react-query';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type PublicListingFamily = 'properties' | 'developments' | 'parkings';

export type PublicPlaceGroup<T> = {
  place: string;
  locationSlug: string;
  title: string;
  total: number;
  preview: T[];
};

type PublicPlaceGroupsEnvelope<T> = {
  success?: boolean;
  error?: string;
  groups?: PublicPlaceGroup<T>[];
  total?: number;
  groupTotal?: number;
  groupOffset?: number;
  groupLimit?: number;
  previewSize?: number;
};

export type PublicPlaceGroupsPage<T> = {
  groups: PublicPlaceGroup<T>[];
  total: number;
  groupTotal: number;
  groupOffset: number;
  groupLimit: number;
  previewSize: number;
};

const DEFAULT_GROUP_LIMIT = 6;
const DEFAULT_PREVIEW_SIZE = 8;

async function fetchPublicPlaceGroups<T>(
  family: PublicListingFamily,
  groupOffset: number,
  groupLimit: number,
  previewSize: number,
  signal?: AbortSignal
): Promise<PublicPlaceGroupsPage<T>> {
  const params = new URLSearchParams({
    family,
    groupOffset: String(groupOffset),
    groupLimit: String(groupLimit),
    previewSize: String(previewSize),
  });
  const response = await fetch(`${FUNCTIONS_URL}/list-public-place-groups?${params.toString()}`, {
    signal,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });
  const body = (await response.json().catch(() => ({}))) as PublicPlaceGroupsEnvelope<T>;

  if (response.status === 429) {
    throw new Error(body.error ?? 'Too many requests. Please wait a moment.');
  }
  if (!response.ok || !body.success || !Array.isArray(body.groups)) {
    throw new Error(body.error ?? 'Failed to load places');
  }

  return {
    groups: body.groups,
    total: body.total ?? 0,
    groupTotal: body.groupTotal ?? body.groups.length,
    groupOffset: body.groupOffset ?? groupOffset,
    groupLimit: body.groupLimit ?? groupLimit,
    previewSize: body.previewSize ?? previewSize,
  };
}

export function usePublicPlaceGroups<T>(
  family: PublicListingFamily,
  enabled: boolean,
  groupLimit = DEFAULT_GROUP_LIMIT,
  previewSize = DEFAULT_PREVIEW_SIZE
) {
  return useInfiniteQuery({
    queryKey: ['list-public-place-groups', family, groupLimit, previewSize],
    queryFn: ({ pageParam, signal }) =>
      fetchPublicPlaceGroups<T>(family, pageParam, groupLimit, previewSize, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.groupOffset + lastPage.groups.length;
      return nextOffset < lastPage.groupTotal ? nextOffset : undefined;
    },
    staleTime: 60_000,
    retry: 1,
    enabled,
  });
}
