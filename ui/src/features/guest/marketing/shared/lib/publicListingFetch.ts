const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type ListingEnvelope<T> = {
  success?: boolean;
  error?: string;
  data?: T;
  total?: number;
  facets?: unknown;
  page?: number;
  pageSize?: number;
};

export type PublicListingResponse<T, F> = {
  data: T[];
  total: number;
  facets: F;
  page: number;
  pageSize: number;
};

export async function publicListingFetch<T, F>(
  functionName: string,
  params: URLSearchParams,
  /** React Query's abort signal — cancels superseded filter/page requests. */
  signal?: AbortSignal
): Promise<PublicListingResponse<T, F>> {
  const url = `${FUNCTIONS_URL}/${functionName}?${params.toString()}`;
  const res = await fetch(url, {
    signal,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });

  const json = (await res.json().catch(() => ({}))) as ListingEnvelope<T[]>;

  if (res.status === 429) {
    throw new Error(json.error ?? 'Too many requests. Please wait a moment.');
  }

  if (!res.ok || !json.success || !Array.isArray(json.data)) {
    throw new Error(json.error ?? `Failed to call ${functionName}`);
  }

  return {
    data: json.data,
    total: typeof json.total === 'number' ? json.total : json.data.length,
    facets: (json.facets ?? {}) as F,
    page: typeof json.page === 'number' ? json.page : 1,
    pageSize: typeof json.pageSize === 'number' ? json.pageSize : json.data.length,
  };
}
