import { useEffect } from 'react';

import { useAdminBrandColorPreview } from '@/features/dashboard/bookings/components/AdminBrandTheme';

/** Live dashboard theme preview while editing org brand color. */
export function OrgSettingsBrandColorPreview({ brandColor }: { brandColor: string | undefined }) {
  const { setBrandColorPreview } = useAdminBrandColorPreview();

  useEffect(() => {
    if (brandColor) setBrandColorPreview(brandColor);
    return () => setBrandColorPreview(null);
  }, [brandColor, setBrandColorPreview]);

  return null;
}
