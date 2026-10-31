import { isKnownResidence } from '@/features/dashboard/org/lib/propertyResidences';

const BUILDING_PROPERTY_TYPES = new Set(['condo', 'apartment']);

export function isBuildingPropertyType(type: string): boolean {
  return BUILDING_PROPERTY_TYPES.has(type.trim().toLowerCase());
}

/** Show floor count instead of sqm for condos/apartments and Azure North residences. */
export function shouldShowPropertyFloors(type: string, residenceName?: string | null): boolean {
  const residence = residenceName?.trim() ?? '';
  if (residence && isKnownResidence(residence)) return true;
  return isBuildingPropertyType(type);
}
