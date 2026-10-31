import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { appendPropertyId } from '@/features/dashboard/org/lib/adminApiScope';
import { appendParkingId } from '@/features/dashboard/org/lib/adminParkingScope';

export type AdminAssetScope = {
  propertyId: string | null;
  parkingId: string | null;
};

export function useAdminAssetScope(): AdminAssetScope {
  return {
    propertyId: useOptionalOrgContext()?.property.id ?? null,
    parkingId: useOptionalParkingContext()?.parking.id ?? null,
  };
}

export function assetScopeQuery(scope: AdminAssetScope): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.parkingId) appendParkingId(params, scope.parkingId);
  else appendPropertyId(params, scope.propertyId);
  return params;
}

export function scopedAssetPath(path: string, scope: AdminAssetScope): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const qs = assetScopeQuery(scope).toString();
  return qs ? `${normalized}?${qs}` : normalized;
}

export function scopedAssetFunctionsUrl(path: string, scope: AdminAssetScope): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  return `${base}${scopedAssetPath(path, scope)}`;
}

export function assetScopeKey(scope: AdminAssetScope): string {
  return scope.parkingId ? `parking:${scope.parkingId}` : `property:${scope.propertyId ?? 'none'}`;
}
