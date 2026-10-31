import { resolvePropertyMapEmbedSrc } from '@/features/guest/marketing/properties/lib/propertyMapEmbed';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';

import { cn } from '@/lib/utils';

type Props = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  placeId?: string | null;
  mapsUrl?: string | null;
  className?: string;
};

export function ShowcaseMapEmbed({
  latitude,
  longitude,
  address,
  placeId,
  mapsUrl,
  className,
}: Props) {
  const { mode } = useShowcaseTheme();
  const embedSrc = resolvePropertyMapEmbedSrc({
    latitude,
    longitude,
    address,
    placeId,
    mapsUrl,
  });

  if (!embedSrc) {
    return (
      <div
        className={cn(
          'bg-muted/40 flex min-h-[240px] items-center justify-center rounded-2xl',
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <iframe
      title="Property location map"
      src={embedSrc}
      className={cn(
        'size-full min-h-[240px] border-0',
        mode === 'dark' && 'property-map-embed-dark',
        className
      )}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
