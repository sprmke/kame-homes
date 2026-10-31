export type SearchSuggestionKind = 'location' | 'development' | 'property' | 'parking';

export type SearchSuggestionItem = {
  kind: SearchSuggestionKind;
  id: string;
  label: string;
  subtitle: string;
  slug?: string;
  city?: string;
};

export type SearchSuggestionsResponse = {
  query: string;
  locations: SearchSuggestionItem[];
  developments: SearchSuggestionItem[];
  properties: SearchSuggestionItem[];
  parkings: SearchSuggestionItem[];
};

export type SearchListingsType = 'all' | 'properties' | 'developments' | 'parkings';

export type SearchListingsQuery = {
  where: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  type: SearchListingsType;
  page: number;
  pageSize: number;
  /** Guest coords for Nearby ranking (WGS84). */
  lat: number | null;
  lng: number | null;
  /**
   * Origin page category to prioritize in All view / typeahead.
   * Does not hide other categories — only reorders (and may soft-land on that tab when alone).
   */
  focus: Exclude<SearchListingsType, 'all'> | null;
};

export type PropertySearchSummary = {
  id: string;
  slug: string;
  name: string;
  type: string;
  city: string | null;
  locationLabel: string;
  residenceName: string | null;
  coverImage: string | null;
  images: string[];
  maxGuests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  amenities: string[];
  latitude?: number | null;
  longitude?: number | null;
};

export type DevelopmentSearchSummary = {
  id: string;
  slug: string;
  name: string;
  type: string;
  city: string | null;
  location: string | null;
  locationLabel: string;
  coverImage: string | null;
  images: string[];
  developerName: string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  propertyCount: number;
  latitude?: number | null;
  longitude?: number | null;
};

export type ParkingSearchSummary = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  locationLabel: string;
  residenceName: string | null;
  tower: string | null;
  level: string | null;
  slotLabel: string;
  parkingType: string;
  coverImage: string | null;
  images: string[];
  ratePerNight: number | null;
  features: string[];
  latitude?: number | null;
  longitude?: number | null;
};

export type SearchListingsTotals = {
  properties: number;
  developments: number;
  parkings: number;
  all: number;
};

export type SearchListingsResponse = {
  query: SearchListingsQuery;
  totals: SearchListingsTotals;
  properties: PropertySearchSummary[];
  developments: DevelopmentSearchSummary[];
  parkings: ParkingSearchSummary[];
  meta: SearchListingsMeta;
};

export type SearchListingsMeta = {
  intent: 'nearby' | 'concept' | 'literal' | 'expanded';
  intentLabel: string | null;
  /** Nearby without usable lat/lng — UI should request permission. */
  needsLocation: boolean;
  /** Literal returned 0; results came from concept expansion. */
  usedSmartFallback: boolean;
  conceptId: string | null;
};
