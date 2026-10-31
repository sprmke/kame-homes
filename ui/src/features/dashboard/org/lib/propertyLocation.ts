/** Default map center — Azure North Residences (2MWV+QVR). */
export const AZURE_NORTH_LOCATION_ADDRESS = '2MWV+QVR, San Fernando, Pampanga, Philippines';

export const AZURE_NORTH_DEFAULT_COORDS = {
  latitude: 15.1696,
  longitude: 120.5598,
} as const;

export const DEFAULT_PROPERTY_MAP_CENTER = {
  lat: AZURE_NORTH_DEFAULT_COORDS.latitude,
  lng: AZURE_NORTH_DEFAULT_COORDS.longitude,
} as const;

export function isAzureNorthResidence(residenceName: string): boolean {
  const normalized = residenceName.trim().toLowerCase();
  return normalized === 'azure north residences' || normalized === 'azure north';
}

export function isPropertyLocationEmpty(
  fields: Pick<PropertyLocationFields, 'address' | 'latitude' | 'longitude'>
): boolean {
  const hasAddress = fields.address.trim().length > 0;
  const hasPin =
    fields.latitude != null &&
    Number.isFinite(fields.latitude) &&
    fields.longitude != null &&
    Number.isFinite(fields.longitude);
  return !hasAddress && !hasPin;
}

export function azureNorthDefaultLocationFields(): PropertyLocationFields {
  const { latitude, longitude } = AZURE_NORTH_DEFAULT_COORDS;
  return {
    address: AZURE_NORTH_LOCATION_ADDRESS,
    city: 'San Fernando',
    province: 'Pampanga',
    country: 'Philippines',
    zipCode: '',
    latitude,
    longitude,
    placeId: '',
    mapsUrl: buildGoogleMapsUrl(latitude, longitude),
  };
}

export function withAzureNorthLocationDefaultsIfEmpty<T extends PropertyLocationFields>(
  residenceName: string,
  fields: T
): T {
  if (!isAzureNorthResidence(residenceName) || !isPropertyLocationEmpty(fields)) {
    return fields;
  }
  return { ...fields, ...azureNorthDefaultLocationFields() };
}

export function applyResidenceLocationDefaultsToDraft(
  residenceName: string,
  draft: Pick<PropertyLocationFields, 'address' | 'latitude' | 'longitude'>
): Partial<PropertyLocationFields> {
  if (!isAzureNorthResidence(residenceName) || !isPropertyLocationEmpty(draft)) {
    return {};
  }
  return azureNorthDefaultLocationFields();
}

export type ParsedAddressParts = {
  city: string;
  province: string;
  country: string;
  zipCode: string;
};

export type PropertyLocationFields = {
  address: string;
  city: string;
  province: string;
  country: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string;
  placeId: string;
};

export function buildGoogleMapsUrl(latitude: number, longitude: number, placeId?: string): string {
  const query = `${latitude},${longitude}`;
  const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  if (placeId?.trim()) {
    return `${base}&query_place_id=${encodeURIComponent(placeId.trim())}`;
  }
  return base;
}

/**
 * Prefer establishment / development name + formatted address so Autocomplete
 * selections keep "AZURE NORTH by Century" instead of only a Plus Code / city line.
 */
export function formatPlaceDisplayAddress(place: {
  name?: string | null;
  formatted_address?: string | null;
}): string {
  const name = place.name?.trim() ?? '';
  const formatted = place.formatted_address?.trim() ?? '';
  if (!name) return formatted;
  if (!formatted) return name;
  if (formatted.toLowerCase().startsWith(name.toLowerCase())) return formatted;
  return `${name}, ${formatted}`;
}

export function parseGoogleAddressComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined
): ParsedAddressParts {
  if (!components?.length) {
    return { city: '', province: '', country: 'Philippines', zipCode: '' };
  }

  const pick = (...types: string[]) => {
    const match = components.find((entry) => types.some((type) => entry.types.includes(type)));
    return match?.long_name?.trim() ?? '';
  };

  const city = pick('locality', 'postal_town', 'administrative_area_level_2', 'sublocality') || '';
  const province = pick('administrative_area_level_1');
  const country = pick('country') || 'Philippines';
  const zipCode = pick('postal_code');

  return { city, province, country, zipCode };
}

export function locationFromPlace(
  place: google.maps.places.PlaceResult
): PropertyLocationFields | null {
  const location = place.geometry?.location;
  if (!location) return null;

  const latitude = location.lat();
  const longitude = location.lng();
  const parts = parseGoogleAddressComponents(place.address_components);
  const address = formatPlaceDisplayAddress(place);
  const placeId = place.place_id?.trim() || '';

  return {
    address,
    ...parts,
    latitude,
    longitude,
    placeId,
    mapsUrl: buildGoogleMapsUrl(latitude, longitude, placeId),
  };
}

export function locationFromGeocoderResult(
  result: google.maps.GeocoderResult
): PropertyLocationFields | null {
  const location = result.geometry?.location;
  if (!location) return null;

  const latitude = location.lat();
  const longitude = location.lng();
  const parts = parseGoogleAddressComponents(result.address_components);
  const address = result.formatted_address?.trim() || '';
  const placeId = result.place_id?.trim() || '';

  return {
    address,
    ...parts,
    latitude,
    longitude,
    placeId,
    mapsUrl: buildGoogleMapsUrl(latitude, longitude, placeId),
  };
}

export function readNullableLatitude(settings: Record<string, unknown>): number | null {
  const value = settings.latitude;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readNullableLongitude(settings: Record<string, unknown>): number | null {
  const value = settings.longitude;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function clonePropertyLocationFields(
  fields: PropertyLocationFields
): PropertyLocationFields {
  return { ...fields };
}

export function propertyLocationFieldsEqual(
  a: PropertyLocationFields,
  b: PropertyLocationFields
): boolean {
  return (
    a.address.trim() === b.address.trim() &&
    a.city.trim() === b.city.trim() &&
    a.province.trim() === b.province.trim() &&
    a.country.trim() === b.country.trim() &&
    a.zipCode.trim() === b.zipCode.trim() &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.placeId.trim() === b.placeId.trim() &&
    a.mapsUrl.trim() === b.mapsUrl.trim()
  );
}

/** Required for Manage Save — address + map pin (city/province/country filled by geocode). */
export function isPropertyLocationManageValid(fields: PropertyLocationFields): boolean {
  return (
    fields.address.trim().length > 0 &&
    fields.latitude != null &&
    Number.isFinite(fields.latitude) &&
    fields.longitude != null &&
    Number.isFinite(fields.longitude)
  );
}

export const PROPERTY_LOCATION_MANAGE_FIELD_IDS = [
  'property-address',
  'property-location-map',
] as const;
