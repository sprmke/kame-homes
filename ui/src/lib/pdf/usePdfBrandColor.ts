import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { resolveOrgBrandHex } from '@/lib/theme/brandColor';

/** Same brand resolution as AdminBrandTheme — property override → parking → org. */
export function usePdfBrandColor(): string {
  const propertyId = usePropertyIdParam();
  const parkingCtx = useOptionalParkingContext();
  const orgBrand = useOrgBrandColor();
  const { data: appSettings } = useAppSettings();

  const parkingStored =
    typeof parkingCtx?.parking.settings?.brandColor === 'string'
      ? parkingCtx.parking.settings.brandColor.trim()
      : '';
  const parkingBrand = parkingCtx ? resolveOrgBrandHex(parkingStored || orgBrand) : null;

  if (propertyId && appSettings?.resolvedBrandColor) {
    return resolveOrgBrandHex(appSettings.resolvedBrandColor);
  }
  return resolveOrgBrandHex(parkingBrand ?? orgBrand);
}
