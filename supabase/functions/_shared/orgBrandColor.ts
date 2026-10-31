/**
 * Resolve org brand color (`organizations.settings.brandColor`) from property scope.
 * @deprecated Prefer loadResolvedBrandColorByPropertyId — includes per-property override.
 */

import {
  invalidatePropertyBrandColorCache,
  loadResolvedBrandColorByPropertyId,
} from './propertyBranding.ts';

export function invalidateOrgBrandColorCache(propertyId?: string | null): void {
  invalidatePropertyBrandColorCache(propertyId);
}

export async function loadOrgBrandColorByPropertyId(propertyId?: string | null): Promise<string> {
  return loadResolvedBrandColorByPropertyId(propertyId);
}
