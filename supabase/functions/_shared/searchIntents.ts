/**
 * Public search intent resolver — Nearby (geo) + common-noun concepts.
 * Keep UI mirror in sync: ui/src/features/guest/search/lib/searchIntents.ts
 *
 * AI / embedding fallback is Phase 2 (documented in route guide) — this module is
 * deterministic synonym + type expansion so results stay fast and predictable.
 */

export type SearchIntentKind = 'nearby' | 'concept' | 'literal';

export type SearchConceptId =
  'condo' | 'beach' | 'house' | 'parking' | 'hotel' | 'mountain' | 'city';

export type ResolvedSearchIntent =
  | {
      kind: 'nearby';
      label: string;
      /** Display token kept in the where field for shareable URLs */
      displayWhere: string;
    }
  | {
      kind: 'concept';
      conceptId: SearchConceptId;
      label: string;
      /** Extra text tokens OR'd into field matching */
      expandedTerms: string[];
      /** Property `type` values to accept (uppercase) */
      propertyTypes: string[];
      /** Prefer focusing this listing family when browsing All */
      preferType?: 'properties' | 'developments' | 'parkings';
    }
  | {
      kind: 'literal';
      query: string;
    };

const NEARBY_PHRASES = [
  'nearby',
  'near me',
  'near by',
  'around me',
  'close by',
  'close to me',
  'near here',
  'in my area',
  'around here',
];

type ConceptDef = {
  id: SearchConceptId;
  label: string;
  triggers: string[];
  expandedTerms: string[];
  propertyTypes: string[];
  preferType?: 'properties' | 'developments' | 'parkings';
};

const CONCEPTS: ConceptDef[] = [
  {
    id: 'condo',
    label: 'Condos',
    triggers: ['condo', 'condos', 'condominium', 'condominiums', 'apartment', 'apartments'],
    expandedTerms: ['condo', 'condominium', 'apartment'],
    propertyTypes: ['CONDO'],
    preferType: 'properties',
  },
  {
    id: 'beach',
    label: 'Beaches',
    triggers: ['beach', 'beaches', 'beachfront', 'seaside', 'seashore', 'coast', 'coastal'],
    expandedTerms: [
      'beach',
      'beachfront',
      'boracay',
      'palawan',
      'el nido',
      'siargao',
      'batangas',
      'laiya',
      'nasugbu',
      'coast',
    ],
    propertyTypes: [],
  },
  {
    id: 'house',
    label: 'Houses',
    triggers: ['house', 'houses', 'home', 'homes', 'villa', 'villas'],
    expandedTerms: ['house', 'home', 'villa'],
    propertyTypes: ['HOUSE', 'VILLA'],
    preferType: 'properties',
  },
  {
    id: 'parking',
    label: 'Parking',
    triggers: ['parking', 'parkings', 'parking slot', 'parking slots', 'car park', 'carpark'],
    expandedTerms: ['parking'],
    propertyTypes: [],
    preferType: 'parkings',
  },
  {
    id: 'hotel',
    label: 'Hotels',
    triggers: ['hotel', 'hotels', 'resort', 'resorts'],
    expandedTerms: ['hotel', 'resort'],
    propertyTypes: ['HOTEL'],
  },
  {
    id: 'mountain',
    label: 'Mountains',
    triggers: ['mountain', 'mountains', 'highland', 'highlands', 'cool climate'],
    expandedTerms: ['mountain', 'baguio', 'tagaytay', 'highland'],
    propertyTypes: [],
  },
  {
    id: 'city',
    label: 'Cities',
    triggers: ['city', 'cities', 'urban', 'metro'],
    expandedTerms: ['manila', 'makati', 'bgc', 'cebu', 'quezon', 'pasig', 'taguig'],
    propertyTypes: [],
  },
];

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** True when the whole query (or a clear phrase) means "near me". */
export function isNearbyQuery(raw: string): boolean {
  const q = normalizeQuery(raw);
  if (!q) return false;
  if (NEARBY_PHRASES.includes(q)) return true;
  return NEARBY_PHRASES.some((phrase) => q.includes(phrase));
}

/** Category token after Nearby (e.g. "Nearby developments" → developments). */
const NEARBY_CATEGORY_TOKENS: Array<{
  type: 'properties' | 'developments' | 'parkings';
  tokens: string[];
}> = [
  { type: 'developments', tokens: ['developments', 'development'] },
  { type: 'properties', tokens: ['properties', 'property', 'stays', 'homes'] },
  { type: 'parkings', tokens: ['parkings', 'parking'] },
];

export function nearbyCategoryFromQuery(
  raw: string
): 'properties' | 'developments' | 'parkings' | null {
  if (!isNearbyQuery(raw)) return null;
  const q = normalizeQuery(raw);
  for (const entry of NEARBY_CATEGORY_TOKENS) {
    if (entry.tokens.some((token) => q.includes(token))) return entry.type;
  }
  return null;
}

export function nearbyDisplayLabel(
  category: 'properties' | 'developments' | 'parkings' | null | undefined
): string {
  if (category === 'developments') return 'Nearby developments';
  if (category === 'properties') return 'Nearby properties';
  if (category === 'parkings') return 'Nearby parkings';
  return 'Nearby';
}

function matchConcept(raw: string): ConceptDef | null {
  const q = normalizeQuery(raw);
  if (!q) return null;
  // Prefer exact / whole-query concept triggers so "Azure condo" stays literal-first.
  for (const concept of CONCEPTS) {
    if (concept.triggers.includes(q)) return concept;
  }
  // Single-token common noun inside a short query (≤3 words) e.g. "beach stays"
  const tokens = q.split(' ').filter(Boolean);
  if (tokens.length <= 3) {
    for (const concept of CONCEPTS) {
      if (tokens.some((token) => concept.triggers.includes(token))) return concept;
    }
  }
  return null;
}

/** When a literal search returns nothing, try a common-noun token as a soft concept. */
export function findConceptFallback(raw: string): ResolvedSearchIntent | null {
  const tokens = normalizeQuery(raw).split(' ').filter(Boolean);
  for (const token of tokens) {
    for (const concept of CONCEPTS) {
      if (concept.triggers.includes(token)) {
        return {
          kind: 'concept',
          conceptId: concept.id,
          label: concept.label,
          expandedTerms: concept.expandedTerms,
          propertyTypes: concept.propertyTypes,
          preferType: concept.preferType,
        };
      }
    }
  }
  return null;
}

/**
 * Resolve guest "where" text into a search intent.
 * Specific names (listing titles, Makati, Azure…) stay `literal`.
 */
export function resolveSearchIntent(raw: string): ResolvedSearchIntent {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'literal', query: '' };

  if (isNearbyQuery(trimmed)) {
    const category = nearbyCategoryFromQuery(trimmed);
    const label = nearbyDisplayLabel(category);
    return { kind: 'nearby', label, displayWhere: label };
  }

  const concept = matchConcept(trimmed);
  if (concept) {
    return {
      kind: 'concept',
      conceptId: concept.id,
      label: concept.label,
      expandedTerms: concept.expandedTerms,
      propertyTypes: concept.propertyTypes,
      preferType: concept.preferType,
    };
  }

  return { kind: 'literal', query: trimmed };
}

/** Haversine distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function readSettingsCoord(
  settings: Record<string, unknown> | null | undefined,
  key: 'latitude' | 'longitude'
): number | null {
  if (!settings) return null;
  const value = settings[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Default browse radius for Nearby (Philippines-scale). */
export const NEARBY_DEFAULT_RADIUS_KM = 120;

/** Typeahead chip subtitle for a resolved concept. */
export function conceptSuggestionSubtitle(conceptId: SearchConceptId): string {
  switch (conceptId) {
    case 'condo':
      return 'Browse condo stays';
    case 'beach':
      return 'Coastal stays & destinations';
    case 'house':
      return 'Browse houses & villas';
    case 'parking':
      return 'Browse parking slots';
    case 'hotel':
      return 'Browse hotels & resorts';
    case 'mountain':
      return 'Highland escapes';
    case 'city':
      return 'Popular city stays';
    default:
      return 'Browse matching stays';
  }
}
