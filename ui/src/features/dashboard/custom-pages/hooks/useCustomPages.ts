import { useQuery } from '@tanstack/react-query';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

export type CustomPageType = 'stay_guide' | 'property_showcase';

export type CustomPageDto = {
  pageType: CustomPageType;
  templateKey: string;
  updatedAt: string;
};

export const CUSTOM_PAGES_QUERY_KEY = ['custom-pages'] as const;

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${token}` };
}

export function useCustomPages() {
  const propertyId = usePropertyIdParam();

  return useQuery({
    queryKey: [...CUSTOM_PAGES_QUERY_KEY, propertyId],
    queryFn: async (): Promise<CustomPageDto[]> => {
      const headers = await authHeaders();
      const res = await fetch(scopedFunctionsUrl('/custom-pages-settings', propertyId), {
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to load custom pages');
      }
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: { pages: CustomPageDto[] };
      };
      if (!json.success || !json.data?.pages) {
        throw new Error(json.error ?? 'Failed to load custom pages');
      }
      return json.data.pages;
    },
    enabled: Boolean(propertyId),
  });
}
