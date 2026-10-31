import { useQuery } from '@tanstack/react-query';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { fetchSavedPropertySlugs } from '@/features/guest/marketing/properties/lib/savedPropertiesApi';
import { savedPropertiesQueryKeys } from '@/features/guest/marketing/properties/lib/savedPropertiesQueryKeys';

export function useSavedPropertySlugsQuery() {
  const { status } = useGuestAuth();

  return useQuery({
    queryKey: savedPropertiesQueryKeys.all,
    queryFn: fetchSavedPropertySlugs,
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

/** Subscribes only when this slug's saved boolean changes (TanStack Query select + structural sharing). */
export function useIsPropertySaved(propertySlug: string): boolean {
  const slug = propertySlug.trim();
  const { status } = useGuestAuth();

  const { data } = useQuery({
    queryKey: savedPropertiesQueryKeys.all,
    queryFn: fetchSavedPropertySlugs,
    enabled: status === 'authenticated' && slug.length > 0,
    staleTime: 60_000,
    select: (slugs) => slugs.includes(slug),
  });

  return data ?? false;
}
