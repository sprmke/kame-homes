import { useEffect } from 'react';

import { useAdminBrandColorPreview } from '@/features/dashboard/bookings/components/AdminBrandTheme';

/** Live dashboard theme preview while editing property brand color. */
export function PropertySettingsBrandColorPreview({
  brandColor,
  resolvedBrandColor,
}: {
  brandColor: string | undefined;
  resolvedBrandColor: string | undefined;
}) {
  const { setBrandColorPreview } = useAdminBrandColorPreview();

  useEffect(() => {
    const preview = brandColor?.trim() || resolvedBrandColor;
    if (preview) setBrandColorPreview(preview);
    return () => setBrandColorPreview(null);
  }, [brandColor, resolvedBrandColor, setBrandColorPreview]);

  return null;
}
