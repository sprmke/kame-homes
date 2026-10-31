import { useMemo } from 'react';

import { useShowcaseMediaPalette } from '@/features/guest/marketing/showcase/hooks/useShowcaseMediaPalette';
import type { ShowcaseMediaPalette } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';

import { resolveMarketingAccentHex } from '@/features/dashboard/marketing/lib/marketingAiPhotoPalette';

import { resolveOrgBrandHex } from '@/lib/theme/brandColor';

export type MarketingMediaAccent = {
  /** Accent for blank/default marketing palettes — photos when available, else brand. */
  accentColor: string;
  brandColor: string;
  mediaPalette: ShowcaseMediaPalette | null;
  loading: boolean;
  /** True when accent came from property photos. */
  fromPhotos: boolean;
};

/**
 * Samples property photos (same as showcase From photos) and resolves the accent
 * used for blank calendar / brand-tinted design & video defaults.
 * Re-runs whenever `photoUrls` change (add/remove/replace gallery images).
 */
export function useMarketingMediaAccent(
  photoUrls: string[],
  brandColor: string | null | undefined,
  enabled = true
): MarketingMediaAccent {
  const urls = useMemo(() => [...new Set(photoUrls.filter(Boolean))].slice(0, 10), [photoUrls]);
  const resolvedBrand = resolveOrgBrandHex(brandColor);
  const { palette: mediaPalette, loading } = useShowcaseMediaPalette(
    urls,
    enabled && urls.length > 0
  );
  const accentColor = resolveMarketingAccentHex(resolvedBrand, mediaPalette);

  return {
    accentColor,
    brandColor: resolvedBrand,
    mediaPalette,
    loading,
    fromPhotos: Boolean(mediaPalette?.accentHexLight),
  };
}
