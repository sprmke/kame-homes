import { useMemo, useState } from 'react';

import {
  buildResponsiveImage,
  DEFAULT_CARD_IMAGE_SIZES,
  storageTransformsEnabled,
} from '@/features/guest/marketing/shared/lib/responsiveImage';

import { cn } from '@/lib/utils';

interface MarketingImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  /** Rendered width hint for `srcset` selection (defaults to card grid sizes). */
  sizes?: string;
}

/**
 * Vite/React substitute for Next.js `Image` used by marketing components.
 * Adds a responsive `srcset` when the host supports resizing, and falls back to the
 * original URL if a resized variant fails to load.
 */
export function MarketingImage({
  src,
  alt,
  fill,
  className,
  priority,
  width,
  height,
  sizes,
}: MarketingImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const responsive = useMemo(
    () => buildResponsiveImage(src, { storageTransforms: storageTransformsEnabled() }),
    [src]
  );
  const useResponsive = responsive != null && failedSrc !== src;

  const shared = {
    src: useResponsive ? responsive.src : src,
    srcSet: useResponsive ? responsive.srcSet : undefined,
    sizes: useResponsive ? (sizes ?? DEFAULT_CARD_IMAGE_SIZES) : undefined,
    alt,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    fetchPriority: priority ? ('high' as const) : undefined,
    decoding: 'async' as const,
    onError: useResponsive ? () => setFailedSrc(src) : undefined,
  };

  if (fill) {
    return <img {...shared} className={cn('absolute inset-0 h-full w-full', className)} />;
  }

  return <img {...shared} width={width} height={height} className={className} />;
}
