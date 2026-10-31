import { useParams, useSearchParams } from 'react-router-dom';

import { readGuestPropertySlug } from '@/features/guest/form/lib/guestPropertyScope';

/** Active property slug from route param (`/properties/:propertySlug/...`) or legacy `?property=`. */
export function useGuestPropertySlug(): string {
  const { propertySlug } = useParams<{ propertySlug?: string }>();
  const [searchParams] = useSearchParams();
  return propertySlug?.trim() || readGuestPropertySlug(searchParams) || '';
}

/** Search params with `property` set when the slug comes from the route segment. */
export function useGuestPropertySearchParams(): URLSearchParams {
  const [searchParams] = useSearchParams();
  const slug = useGuestPropertySlug();
  const next = new URLSearchParams(searchParams);
  if (slug && !readGuestPropertySlug(next)) {
    next.set('property', slug);
  }
  return next;
}
