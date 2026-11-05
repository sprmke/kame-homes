import { useMemo } from 'react';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useMarketingMediaAccent } from '@/features/dashboard/marketing/hooks/useMarketingMediaAccent';
import { resolveMarketingAiLookPresentation } from '@/features/dashboard/marketing/lib/marketingAiPhotoPalette';
import {
  propertyGalleryMediaItems,
  propertyMediaItems,
} from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { buildPropertyColorsThemeTokens } from '@/features/dashboard/marketing/lib/theme/starterThemes';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';

export type MarketingPropertyLook = {
  brandColor: string;
  /** Gallery images (no videos), deduped, gallery order. */
  photoUrls: string[];
  coverPhotoUrl: string | undefined;
  /** The built-in "Property colors" theme (photos when sampled, else brand). */
  propertyColorsTokens: MarketingThemeTokens;
  fromPhotos: boolean;
  /** False while property photos are still being sampled. */
  ready: boolean;
};

/** Brand, photos and the derived "Property colors" theme for the current property. */
export function useMarketingPropertyLook(): MarketingPropertyLook {
  const { property } = useOrgContext();
  const { data: appSettings } = useAppSettings();
  const { data: publicProperty, isLoading: propertyLoading } = usePublicPropertyDetail(
    property.slug
  );
  const orgBrandColor = useOrgBrandColor();
  const rawBrand = appSettings?.resolvedBrandColor ?? orgBrandColor;

  const photoUrls = useMemo(() => {
    const gallery = publicProperty?.media?.length
      ? propertyGalleryMediaItems(
          publicProperty.media.map((item) => ({ url: item.url, type: item.type }))
        )
      : propertyMediaItems(publicProperty?.images ?? []);
    return gallery.filter((item) => item.type === 'image').map((item) => item.url);
  }, [publicProperty?.media, publicProperty?.images]);

  const { brandColor, mediaPalette, loading, fromPhotos } = useMarketingMediaAccent(
    photoUrls,
    rawBrand
  );

  const propertyColorsTokens = useMemo(() => {
    const look = resolveMarketingAiLookPresentation(brandColor, mediaPalette);
    return buildPropertyColorsThemeTokens(look.tokenPalette, look.calendarPreview.ink);
  }, [brandColor, mediaPalette]);

  return {
    brandColor,
    photoUrls,
    coverPhotoUrl: photoUrls[0],
    propertyColorsTokens,
    fromPhotos,
    ready: !propertyLoading && !loading,
  };
}
