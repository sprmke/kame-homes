/**
 * Azure North default map pin — keep in sync with ui/src/features/dashboard/org/lib/propertyLocation.ts
 */

export const AZURE_NORTH_LOCATION_ADDRESS = '2MWV+QVR, San Fernando, Pampanga, Philippines';

export const AZURE_NORTH_DEFAULT_COORDS = {
  latitude: 15.1696,
  longitude: 120.5598,
} as const;

export function isAzureNorthResidence(residenceName: string): boolean {
  const normalized = residenceName.trim().toLowerCase();
  return normalized === 'azure north residences' || normalized === 'azure north';
}

function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

/** Settings JSONB fields + top-level address for new Azure North properties/parkings. */
export function azureNorthLocationSeed(): {
  address: string;
  settings: Record<string, unknown>;
} {
  const { latitude, longitude } = AZURE_NORTH_DEFAULT_COORDS;
  return {
    address: AZURE_NORTH_LOCATION_ADDRESS,
    settings: {
      city: 'San Fernando',
      province: 'Pampanga',
      country: 'Philippines',
      zipCode: '',
      latitude,
      longitude,
      mapsUrl: buildGoogleMapsUrl(latitude, longitude),
      placeId: '',
    },
  };
}
