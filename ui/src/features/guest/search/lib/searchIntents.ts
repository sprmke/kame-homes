/**
 * Client mirror of supabase/functions/_shared/searchIntents.ts — keep triggers in sync.
 */

export type SearchIntentKind = 'nearby' | 'concept' | 'literal';

export type SearchConceptId =
  'condo' | 'beach' | 'house' | 'parking' | 'hotel' | 'mountain' | 'city';

export type ResolvedClientSearchIntent =
  | { kind: 'nearby'; label: string; displayWhere: string }
  | {
      kind: 'concept';
      conceptId: SearchConceptId;
      label: string;
      /** Uppercase property `type` values when the concept maps to a hard type. */
      propertyTypes: string[];
      preferType?: 'properties' | 'developments' | 'parkings';
    }
  | { kind: 'literal'; query: string };

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

const CONCEPT_TRIGGERS: Array<{
  id: SearchConceptId;
  label: string;
  triggers: string[];
  propertyTypes: string[];
  preferType?: 'properties' | 'developments' | 'parkings';
}> = [
  {
    id: 'condo',
    label: 'Condos',
    triggers: ['condo', 'condos', 'condominium', 'condominiums', 'apartment', 'apartments'],
    propertyTypes: ['CONDO'],
    preferType: 'properties',
  },
  {
    id: 'beach',
    label: 'Beaches',
    triggers: ['beach', 'beaches', 'beachfront', 'seaside', 'seashore', 'coast', 'coastal'],
    propertyTypes: [],
  },
  {
    id: 'house',
    label: 'Houses',
    triggers: ['house', 'houses', 'home', 'homes', 'villa', 'villas'],
    propertyTypes: ['HOUSE', 'VILLA'],
    preferType: 'properties',
  },
  {
    id: 'parking',
    label: 'Parking',
    triggers: ['parking', 'parkings', 'parking slot', 'parking slots', 'car park', 'carpark'],
    propertyTypes: [],
    preferType: 'parkings',
  },
  {
    id: 'hotel',
    label: 'Hotels',
    triggers: ['hotel', 'hotels', 'resort', 'resorts'],
    propertyTypes: ['HOTEL'],
  },
  {
    id: 'mountain',
    label: 'Mountains',
    triggers: ['mountain', 'mountains', 'highland', 'highlands', 'cool climate'],
    propertyTypes: [],
  },
  {
    id: 'city',
    label: 'Cities',
    triggers: ['city', 'cities', 'urban', 'metro'],
    propertyTypes: [],
  },
];

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

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

export function isConceptSuggestionId(id: string): boolean {
  return id.startsWith('concept:');
}

export function resolveClientSearchIntent(raw: string): ResolvedClientSearchIntent {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'literal', query: '' };

  if (isNearbyQuery(trimmed)) {
    const category = nearbyCategoryFromQuery(trimmed);
    const label = nearbyDisplayLabel(category);
    return { kind: 'nearby', label, displayWhere: label };
  }

  const q = normalizeQuery(trimmed);
  for (const concept of CONCEPT_TRIGGERS) {
    if (concept.triggers.includes(q)) {
      return {
        kind: 'concept',
        conceptId: concept.id,
        label: concept.label,
        propertyTypes: concept.propertyTypes,
        preferType: concept.preferType,
      };
    }
  }
  const tokens = q.split(' ').filter(Boolean);
  if (tokens.length <= 3) {
    for (const concept of CONCEPT_TRIGGERS) {
      if (tokens.some((token) => concept.triggers.includes(token))) {
        return {
          kind: 'concept',
          conceptId: concept.id,
          label: concept.label,
          propertyTypes: concept.propertyTypes,
          preferType: concept.preferType,
        };
      }
    }
  }

  return { kind: 'literal', query: trimmed };
}

/**
 * Concepts that list-public-* can represent without synonym expansion:
 * hard property types (condo/house/hotel) or parking family focus.
 * Synonym-only concepts (beach/mountain/city) stay on search-listings.
 */
export function canBridgeConceptToListPublic(
  intent: Extract<ResolvedClientSearchIntent, { kind: 'concept' }>
): boolean {
  if (intent.preferType === 'parkings') return true;
  return intent.propertyTypes.length > 0;
}
