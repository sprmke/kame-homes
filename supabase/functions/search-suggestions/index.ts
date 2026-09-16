/**
 * search-suggestions — Public GET typeahead for marketing search bar.
 * Trigger: HeroSearch "where" panel (≥2 chars, debounced). Auth: anon key (verify_jwt=false).
 * Query: ?q=&limit=8
 * Rate limit: per-IP in-memory throttle (see _shared/publicRateLimit.ts).
 *
 * Smart intents: Nearby chip; concept chip (Condo/Beach/…) + type-first then synonym
 * listing previews; literal name/city ranking with exact/prefix/word-start boosts.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { pruneExpiredRateLimitBuckets } from '../_shared/publicRateLimit.ts';
import {
  escapeIlikePattern,
  postgrestOrIlikeValue,
  rankTextMatch,
  type SearchSuggestionItem,
} from '../_shared/publicSearch.ts';
import {
  conceptSuggestionSubtitle,
  nearbyCategoryFromQuery,
  nearbyDisplayLabel,
  resolveSearchIntent,
  type ResolvedSearchIntent,
} from '../_shared/searchIntents.ts';
import { servePublic } from '../_shared/serveEdge.ts';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 16;
const PER_GROUP = 4;
const CONCEPT_FETCH_LIMIT = 80;

type ScoredSuggestion = SearchSuggestionItem & { score: number };

function asSettings(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === 'object' && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};
}

function matchesPropertyType(type: string | null | undefined, allowed: string[]): boolean {
  if (!allowed.length || !type) return false;
  return allowed.includes(String(type).trim().toUpperCase());
}

function termRank(terms: string[], ...fields: Array<string | null | undefined>): number {
  let best = 0;
  for (const term of terms) {
    best = Math.max(best, rankTextMatch(term, ...fields));
  }
  return best;
}

function stripScore({ score: _score, ...item }: ScoredSuggestion): SearchSuggestionItem {
  return item;
}

function takeTop(items: ScoredSuggestion[], limit: number): SearchSuggestionItem[] {
  return items
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(stripScore);
}

function trimOverflow(
  grouped: {
    locations: SearchSuggestionItem[];
    developments: SearchSuggestionItem[];
    properties: SearchSuggestionItem[];
    parkings: SearchSuggestionItem[];
  },
  limit: number
): typeof grouped {
  const total =
    grouped.locations.length +
    grouped.developments.length +
    grouped.properties.length +
    grouped.parkings.length;
  if (total <= limit) return grouped;

  const order: Array<keyof typeof grouped> = [
    'locations',
    'developments',
    'properties',
    'parkings',
  ];
  let overflow = total - limit;
  while (overflow > 0) {
    let trimmed = false;
    for (const key of [...order].reverse()) {
      // Never drop the concept / Nearby chip from Locations.
      const minKeep =
        key === 'locations' && grouped.locations[0]?.id.startsWith('concept:') ? 1 : 1;
      if (grouped[key].length > minKeep) {
        grouped[key].pop();
        overflow -= 1;
        trimmed = true;
        if (overflow <= 0) break;
      }
    }
    if (!trimmed) break;
  }
  return grouped;
}

async function buildConceptSuggestions(
  intent: Extract<ResolvedSearchIntent, { kind: 'concept' }>,
  limit: number
): Promise<{
  locations: SearchSuggestionItem[];
  developments: SearchSuggestionItem[];
  properties: SearchSuggestionItem[];
  parkings: SearchSuggestionItem[];
}> {
  const supabase = createServiceClient();
  const { expandedTerms, propertyTypes, preferType, conceptId, label } = intent;

  const [propertiesRes, developmentsRes, parkingsRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id, slug, name, type, city, residence_name, status')
      .eq('status', 'ACTIVE')
      .limit(CONCEPT_FETCH_LIMIT),
    supabase
      .from('developments')
      .select('id, slug, name, type, city, location, status')
      .eq('status', 'ACTIVE')
      .limit(CONCEPT_FETCH_LIMIT),
    supabase
      .from('parkings')
      .select('id, slug, name, residence_name, tower, status, settings')
      .eq('status', 'ACTIVE')
      .limit(CONCEPT_FETCH_LIMIT),
  ]);

  if (propertiesRes.error || developmentsRes.error || parkingsRes.error) {
    console.error('[search-suggestions] concept', {
      properties: propertiesRes.error,
      developments: developmentsRes.error,
      parkings: parkingsRes.error,
    });
    throw new Error('Failed to load concept suggestions');
  }

  const properties: ScoredSuggestion[] = (propertiesRes.data ?? []).map((row) => {
    const hard = matchesPropertyType(row.type as string, propertyTypes);
    const soft = termRank(
      expandedTerms,
      row.name as string,
      row.city as string | null,
      row.residence_name as string | null
    );
    // Hard type first (Condo → CONDO), then synonym/place fill.
    const score = hard ? 1000 + soft : soft;
    return {
      kind: 'property' as const,
      id: row.id as string,
      label: row.name as string,
      subtitle: [row.city, row.residence_name].filter(Boolean).join(' · ') || 'Property',
      slug: row.slug as string,
      score,
    };
  });

  const developments: ScoredSuggestion[] = (developmentsRes.data ?? []).map((row) => {
    const hard = matchesPropertyType(row.type as string, propertyTypes);
    const soft = termRank(
      expandedTerms,
      row.name as string,
      row.city as string | null,
      row.location as string | null
    );
    const score = hard ? 1000 + soft : soft;
    return {
      kind: 'development' as const,
      id: row.id as string,
      label: row.name as string,
      subtitle: (row.location as string) || (row.city as string) || 'Development',
      slug: row.slug as string,
      score,
    };
  });

  const parkings: ScoredSuggestion[] = (parkingsRes.data ?? []).map((row) => {
    const settings = asSettings(row.settings);
    const city = typeof settings.city === 'string' ? settings.city.trim() : '';
    const soft = termRank(
      expandedTerms,
      row.name as string,
      row.residence_name as string | null,
      row.tower as string | null,
      city
    );
    // Parking concept: inventory is the match — give a floor score so slots appear.
    const score = preferType === 'parkings' ? Math.max(soft, 40) : soft;
    return {
      kind: 'parking' as const,
      id: row.id as string,
      label: row.name as string,
      subtitle: [row.residence_name, row.tower, city].filter(Boolean).join(' · ') || 'Parking',
      slug: row.slug as string,
      score,
    };
  });

  const conceptChip: SearchSuggestionItem = {
    kind: 'location',
    id: `concept:${conceptId}`,
    label,
    subtitle: conceptSuggestionSubtitle(conceptId),
  };

  let propertyItems = takeTop(properties, PER_GROUP);
  let developmentItems = takeTop(developments, PER_GROUP);
  let parkingItems = takeTop(parkings, PER_GROUP);

  // Prefer the concept's primary family in the preview budget.
  if (preferType === 'properties') {
    propertyItems = takeTop(properties, Math.min(PER_GROUP + 1, 5));
  } else if (preferType === 'parkings') {
    parkingItems = takeTop(parkings, Math.min(PER_GROUP + 1, 5));
    propertyItems = [];
    developmentItems = [];
  } else if (preferType === 'developments') {
    developmentItems = takeTop(developments, Math.min(PER_GROUP + 1, 5));
  }

  return trimOverflow(
    {
      locations: [conceptChip],
      developments: developmentItems,
      properties: propertyItems,
      parkings: parkingItems,
    },
    limit
  );
}

servePublic('search-suggestions', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  pruneExpiredRateLimitBuckets();
  const limited = await publicGetRateLimitGate(req, 'search-suggestions');
  if (limited) return limited;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const intent = resolveSearchIntent(q);

  if (intent.kind === 'nearby') {
    const category = nearbyCategoryFromQuery(q);
    const label = nearbyDisplayLabel(category);
    return jsonSuccess(req, {
      query: q,
      locations: [
        {
          kind: 'location' as const,
          id: 'nearby',
          label,
          subtitle:
            category === 'developments'
              ? 'Developments around you'
              : category === 'properties'
                ? 'Stays around you'
                : category === 'parkings'
                  ? 'Parking around you'
                  : 'Uses your location',
        },
      ],
      developments: [] as SearchSuggestionItem[],
      properties: [] as SearchSuggestionItem[],
      parkings: [] as SearchSuggestionItem[],
    });
  }

  if (q.length < 2) {
    return jsonSuccess(req, {
      query: q,
      locations: [] as SearchSuggestionItem[],
      developments: [] as SearchSuggestionItem[],
      properties: [] as SearchSuggestionItem[],
      parkings: [] as SearchSuggestionItem[],
    });
  }

  if (intent.kind === 'concept') {
    try {
      const grouped = await buildConceptSuggestions(intent, limit);
      return jsonSuccess(req, { query: q, ...grouped });
    } catch (error) {
      console.error('[search-suggestions] concept', error);
      return jsonError(req, 'Failed to load suggestions', 500);
    }
  }

  const orPattern = postgrestOrIlikeValue(q);
  const ilikePattern = `%${escapeIlikePattern(q)}%`;
  const supabase = createServiceClient();

  const [propertiesRes, developmentsRes, parkingsRes, propertyCitiesRes, developmentCitiesRes] =
    await Promise.all([
      supabase
        .from('properties')
        .select('id, slug, name, city, residence_name, status')
        .eq('status', 'ACTIVE')
        .or(`name.ilike.${orPattern},city.ilike.${orPattern},residence_name.ilike.${orPattern}`)
        .limit(24),
      supabase
        .from('developments')
        .select('id, slug, name, city, location, status')
        .eq('status', 'ACTIVE')
        .or(`name.ilike.${orPattern},city.ilike.${orPattern},location.ilike.${orPattern}`)
        .limit(24),
      supabase
        .from('parkings')
        .select('id, slug, name, residence_name, tower, status, settings')
        .eq('status', 'ACTIVE')
        .or(`name.ilike.${orPattern},residence_name.ilike.${orPattern},tower.ilike.${orPattern}`)
        .limit(24),
      supabase
        .from('properties')
        .select('city')
        .eq('status', 'ACTIVE')
        .not('city', 'is', null)
        .ilike('city', ilikePattern)
        .limit(40),
      supabase
        .from('developments')
        .select('city')
        .eq('status', 'ACTIVE')
        .not('city', 'is', null)
        .ilike('city', ilikePattern)
        .limit(40),
    ]);

  if (propertiesRes.error || developmentsRes.error || parkingsRes.error) {
    console.error('[search-suggestions]', {
      properties: propertiesRes.error,
      developments: developmentsRes.error,
      parkings: parkingsRes.error,
    });
    return jsonError(req, 'Failed to load suggestions', 500);
  }

  const properties: SearchSuggestionItem[] = takeTop(
    (propertiesRes.data ?? []).map((row) => ({
      kind: 'property' as const,
      id: row.id as string,
      label: row.name as string,
      subtitle: [row.city, row.residence_name].filter(Boolean).join(' · ') || 'Property',
      slug: row.slug as string,
      score: rankTextMatch(q, row.name, row.city, row.residence_name),
    })),
    PER_GROUP
  );

  const developments: SearchSuggestionItem[] = takeTop(
    (developmentsRes.data ?? []).map((row) => ({
      kind: 'development' as const,
      id: row.id as string,
      label: row.name as string,
      subtitle: (row.location as string) || (row.city as string) || 'Development',
      slug: row.slug as string,
      score: rankTextMatch(q, row.name, row.city, row.location),
    })),
    PER_GROUP
  );

  const parkings: SearchSuggestionItem[] = takeTop(
    (parkingsRes.data ?? []).map((row) => {
      const settings = asSettings(row.settings);
      const city = typeof settings.city === 'string' ? settings.city.trim() : '';
      return {
        kind: 'parking' as const,
        id: row.id as string,
        label: row.name as string,
        subtitle: [row.residence_name, row.tower, city].filter(Boolean).join(' · ') || 'Parking',
        slug: row.slug as string,
        score: rankTextMatch(q, row.name, row.residence_name, row.tower, city),
      };
    }),
    PER_GROUP
  );

  const cityCounts = new Map<string, number>();
  for (const row of [...(propertyCitiesRes.data ?? []), ...(developmentCitiesRes.data ?? [])]) {
    const city = typeof row.city === 'string' ? row.city.trim() : '';
    if (!city) continue;
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }

  const locations: SearchSuggestionItem[] = takeTop(
    [...cityCounts.entries()].map(([city, count]) => ({
      kind: 'location' as const,
      id: `location:${city.toLowerCase()}`,
      label: city,
      subtitle: count === 1 ? '1 listing area' : `${count} listing areas`,
      city,
      score: rankTextMatch(q, city),
    })),
    PER_GROUP
  );

  const grouped = trimOverflow({ locations, developments, properties, parkings }, limit);

  return jsonSuccess(req, {
    query: q,
    locations: grouped.locations,
    developments: grouped.developments,
    properties: grouped.properties,
    parkings: grouped.parkings,
  });
});
