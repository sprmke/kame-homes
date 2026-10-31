/**
 * Resolves the public development a property/parking belongs to, from its
 * `residence_name` (case-insensitive exact match on ACTIVE `developments.name`).
 * Used by public detail payloads so the UI links real developments instead of
 * guessing from a static catalog.
 */

import { createServiceClient } from './orgAuth.ts';
import { escapeIlikePattern } from './publicSearch.ts';

export type PublicDevelopmentLink = {
  slug: string;
  name: string;
  locationLabel: string;
};

export async function resolvePublicDevelopmentLink(
  residenceName: string | null | undefined
): Promise<PublicDevelopmentLink | null> {
  const name = residenceName?.trim();
  if (!name) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('developments')
    .select('slug, name, location, city')
    .eq('status', 'ACTIVE')
    .ilike('name', escapeIlikePattern(name))
    .order('id')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[publicDevelopmentLink] lookup failed:', error.message);
    return null;
  }
  if (!data?.slug || !data.name) return null;

  const location = (data.location as string | null)?.trim() || '';
  const city = (data.city as string | null)?.trim() || '';
  return {
    slug: data.slug as string,
    name: data.name as string,
    locationLabel: location || city,
  };
}
