import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

function normalizePart(part: string): string {
  return part.trim().toLowerCase();
}

/** Drop repeated locality fragments (e.g. "Philippines" twice). */
export function dedupeLocationParts(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    const key = normalizePart(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export type ParsedShowcaseAddress = {
  city: string;
  state: string;
  country: string;
  /** Plus code / street prefix before city (when address is comma-separated). */
  streetLine: string;
};

/** Parse comma-separated addresses from property settings / Google formatted_address. */
export function parseShowcaseAddressParts(address: string): ParsedShowcaseAddress {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { city: '', state: '', country: '', streetLine: '' };
  }

  if (parts.length === 1) {
    const only = parts[0] ?? '';
    return { city: '', state: '', country: only, streetLine: only };
  }

  const country = parts[parts.length - 1] ?? '';
  const state = parts.length >= 3 ? (parts[parts.length - 2] ?? '') : '';
  const city = parts.length >= 3 ? (parts[parts.length - 3] ?? '') : (parts[0] ?? '');

  let streetLine = '';
  if (parts.length >= 4) {
    streetLine = parts.slice(0, parts.length - 3).join(', ');
  } else if (parts.length === 3) {
    streetLine = parts[0] ?? '';
  } else if (parts.length === 2) {
    streetLine = parts[0] ?? '';
  }

  return { city, state, country, streetLine };
}

type ShowcaseLocationInput = Pick<
  ShowcaseData,
  'address' | 'city' | 'state' | 'country' | 'locationLabel'
>;

function isCountryOnlyLabel(label: string, country: string): boolean {
  const normalized = label.trim().toLowerCase();
  const countryNorm = country.trim().toLowerCase();
  return normalized.length > 0 && (normalized === countryNorm || normalized === 'philippines');
}

/** Normalize city / province / country from saved fields, location label, and full address. */
export function resolveShowcaseLocationFields(
  input: ShowcaseLocationInput & { location?: string }
) {
  const location = input.location?.trim() || input.locationLabel?.trim() || '';
  const address = input.address?.trim() || '';
  let city = input.city?.trim() || '';
  let state = input.state?.trim() || '';
  let country = input.country?.trim() || 'Philippines';

  const labelParts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!city && labelParts.length >= 1) {
    const first = labelParts[0] ?? '';
    if (first && !isCountryOnlyLabel(first, country)) city = first;
  }
  if (!state && labelParts.length >= 2) {
    const candidate = labelParts.length >= 3 ? labelParts[1] : labelParts[labelParts.length - 2];
    if (candidate && candidate !== city && !isCountryOnlyLabel(candidate, country)) {
      state = candidate;
    }
  }

  if (address.includes(',')) {
    const parsed = parseShowcaseAddressParts(address);
    if (!city && parsed.city) city = parsed.city;
    if (!state && parsed.state) state = parsed.state;
    if (parsed.country) country = parsed.country;
  }

  const areaFromFields = dedupeLocationParts([city, state, country]);
  const locationLabel =
    areaFromFields.length > 0 && !isCountryOnlyLabel(areaFromFields.join(', '), country)
      ? areaFromFields.join(', ')
      : address || location || country;

  return { address, city, state: state || null, country, locationLabel };
}

/** City / province / country line for location section + footer subtitle. */
export function formatShowcaseAreaLabel(data: ShowcaseLocationInput): string {
  const resolved = resolveShowcaseLocationFields(data);
  const fromFields = dedupeLocationParts([resolved.city, resolved.state, resolved.country]);
  if (fromFields.length > 0 && !isCountryOnlyLabel(fromFields.join(', '), resolved.country)) {
    return fromFields.join(', ');
  }

  if (resolved.address.includes(',')) {
    const parsed = parseShowcaseAddressParts(resolved.address);
    const fromAddress = dedupeLocationParts([parsed.city, parsed.state, parsed.country]);
    if (fromAddress.length > 0 && !isCountryOnlyLabel(fromAddress.join(', '), resolved.country)) {
      return fromAddress.join(', ');
    }
  }

  if (resolved.address.trim()) return resolved.address.trim();

  const label = data.locationLabel?.trim();
  if (label && !isCountryOnlyLabel(label, resolved.country)) {
    return dedupeLocationParts([label, resolved.country]).join(', ');
  }

  return resolved.country?.trim() || label || '';
}

/** Street / plus-code line from property settings (`properties.address`). */
export function formatShowcaseStreetLine(
  data: Pick<ShowcaseData, 'address' | 'city' | 'state' | 'country' | 'locationLabel'>
): string {
  const address = data.address?.trim() || '';
  if (!address) return '';

  const areaLabel = formatShowcaseAreaLabel(data);
  const parsed = parseShowcaseAddressParts(address);

  if (
    parsed.streetLine &&
    parsed.streetLine.toLowerCase() !== areaLabel.toLowerCase() &&
    !areaLabel.toLowerCase().includes(parsed.streetLine.toLowerCase())
  ) {
    return parsed.streetLine;
  }

  if (
    address.toLowerCase() !== areaLabel.toLowerCase() &&
    !areaLabel.toLowerCase().includes(address.toLowerCase())
  ) {
    return address;
  }

  return '';
}

/** Full query for map embed + directions fallback. */
export function formatShowcaseAddress(
  data: Pick<ShowcaseData, 'address' | 'city' | 'state' | 'country' | 'zipCode'>
): string {
  const street = data.address?.trim() || '';
  if (street.includes(',') && street.split(',').filter((part) => part.trim()).length >= 2) {
    return street;
  }
  return dedupeLocationParts([street, data.city, data.state, data.zipCode, data.country]).join(
    ', '
  );
}

export function buildShowcaseLocationLabel(
  data: Pick<ShowcaseData, 'address' | 'city' | 'state' | 'country' | 'locationLabel'> & {
    location?: string;
  }
): string {
  return resolveShowcaseLocationFields(data).locationLabel;
}

export function formatShowcaseMapsLink(
  data: Pick<
    ShowcaseData,
    'latitude' | 'longitude' | 'address' | 'city' | 'state' | 'country' | 'zipCode' | 'mapsUrl'
  >
): string | null {
  if (data.mapsUrl?.trim()) return data.mapsUrl.trim();
  if (data.latitude != null && data.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
  }
  const full = formatShowcaseAddress(data);
  if (!full) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
}

export function shouldShowShowcaseStreetLine(areaLabel: string, streetLine: string): boolean {
  if (!streetLine) return false;
  const area = areaLabel.trim().toLowerCase();
  const street = streetLine.trim().toLowerCase();
  if (!area) return true;
  if (street === area) return false;
  if (area.includes(street)) return false;
  return true;
}

type ShowcaseLocationData = Pick<
  ShowcaseData,
  | 'address'
  | 'city'
  | 'state'
  | 'country'
  | 'locationLabel'
  | 'latitude'
  | 'longitude'
  | 'placeId'
  | 'mapsUrl'
>;

/** True when property settings supply enough data to render location (not preview filler). */
export function hasShowcaseLocationContent(data: ShowcaseLocationData): boolean {
  const hasGeo =
    (data.latitude != null && data.longitude != null) ||
    Boolean(data.placeId?.trim()) ||
    Boolean(data.mapsUrl?.trim());

  const resolved = resolveShowcaseLocationFields({
    address: data.address,
    city: data.city,
    state: data.state,
    country: data.country,
    locationLabel: data.locationLabel,
  });

  const address = resolved.address.trim();
  const hasStructuredLocality = Boolean(resolved.city.trim()) || Boolean(resolved.state?.trim());
  const hasFormattedAddress =
    address.length > 3 && (address.includes(',') || !isCountryOnlyLabel(address, resolved.country));

  const areaLabel = formatShowcaseAreaLabel(data);
  const hasMeaningfulArea =
    Boolean(areaLabel.trim()) && !isCountryOnlyLabel(areaLabel, resolved.country);

  return hasGeo || hasStructuredLocality || hasFormattedAddress || hasMeaningfulArea;
}
