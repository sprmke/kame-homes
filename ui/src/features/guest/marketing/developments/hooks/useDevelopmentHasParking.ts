import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import { DEFAULT_PARKINGS_QUERY } from '@/features/guest/marketing/parkings/lib/parkingsQuery';

/** True when the development has at least one ACTIVE public parking slot (count-only query). */
export function useDevelopmentHasParking(developmentSlug: string): boolean {
  const slug = developmentSlug.trim().toLowerCase();
  const result = usePublicParkings(
    { ...DEFAULT_PARKINGS_QUERY, developmentSlug: slug, pageSize: 1 },
    Boolean(slug)
  );
  return (result.data?.total ?? 0) > 0;
}
