import { useState, type ReactNode } from 'react';

import { ExternalLink, MapPin } from 'lucide-react';

import { resolvePropertyMapEmbedSrc } from '@/features/guest/marketing/properties/lib/propertyMapEmbed';

import { getGoogleMapsApiKey } from '@/lib/google-maps/useGoogleMapsLoader';
import { cn } from '@/lib/utils';

type Props = {
  href: string;
  lat: number | null;
  lng: number | null;
  label: string;
  outbound?: boolean;
  /**
   * Compact chip (no iframe / no tall preview). Use in voice captions and tight layouts —
   * full embeds leave a blank hole when Google blocks framing.
   */
  compact?: boolean;
  className?: string;
};

function googleStaticMapUrl(lat: number, lng: number): string | null {
  const key = getGoogleMapsApiKey();
  if (!key) return null;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '15',
    size: '600x280',
    scale: '2',
    maptype: 'roadmap',
    markers: `color:0xC4A35A|${lat},${lng}`,
    key,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function MapCardChrome({
  href,
  label,
  outbound,
  children,
  className,
}: {
  href: string;
  label: string;
  outbound: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative my-1.5 overflow-hidden rounded-xl border',
        outbound
          ? 'border-primary-foreground/25 bg-primary-foreground/10'
          : 'border-border/70 bg-muted/40',
        className
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-visible:ring-ring absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2"
        aria-label={`Open in Maps: ${label}`}
      />
      {children}
      <div
        className={cn(
          'relative flex min-h-[44px] items-center justify-between gap-2 px-3 py-2',
          outbound ? 'bg-primary/90 text-primary-foreground' : 'bg-card/95 text-foreground'
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-snug">{label}</p>
          <p
            className={cn(
              'text-[11px] leading-snug',
              outbound ? 'text-primary-foreground/75' : 'text-muted-foreground'
            )}
          >
            Open in Maps
          </p>
        </div>
        <ExternalLink className="size-4 shrink-0 opacity-70" aria-hidden />
      </div>
    </div>
  );
}

/**
 * Map preview for chat — Static Maps img when key is set, else embed, else compact pin row.
 * Prefer `compact` inside voice captions (iframe mid-bubble breaks the layout).
 */
export function ChatMapLinkCard({
  href,
  lat,
  lng,
  label,
  outbound = false,
  compact = false,
  className,
}: Props) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const [staticFailed, setStaticFailed] = useState(false);
  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const staticSrc = hasCoords && !staticFailed ? googleStaticMapUrl(lat!, lng!) : null;
  const embedSrc =
    !compact && hasCoords && !embedFailed
      ? resolvePropertyMapEmbedSrc({ latitude: lat, longitude: lng })
      : null;

  const useCompact = compact || (!staticSrc && !embedSrc);

  if (useCompact) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'my-1.5 flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2.5 no-underline transition-opacity hover:opacity-95',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
          outbound
            ? 'border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground'
            : 'border-border/70 bg-muted/50 text-foreground',
          className
        )}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            outbound ? 'bg-primary-foreground/15' : 'bg-muted'
          )}
        >
          <MapPin className="size-4 opacity-80" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-snug">{label}</span>
          <span
            className={cn(
              'block text-[11px] leading-snug',
              outbound ? 'text-primary-foreground/75' : 'text-muted-foreground'
            )}
          >
            Open in Maps
          </span>
        </span>
        <ExternalLink className="size-4 shrink-0 opacity-70" aria-hidden />
      </a>
    );
  }

  return (
    <MapCardChrome href={href} label={label} outbound={outbound} className={className}>
      <div
        className={cn(
          'relative aspect-[2/1] w-full overflow-hidden',
          outbound ? 'bg-primary-foreground/15' : 'bg-muted'
        )}
      >
        {staticSrc ? (
          <img
            src={staticSrc}
            alt=""
            width={600}
            height={280}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setStaticFailed(true)}
          />
        ) : embedSrc ? (
          <iframe
            title={`Map: ${label}`}
            src={embedSrc}
            className="pointer-events-none absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            tabIndex={-1}
            aria-hidden
            onError={() => setEmbedFailed(true)}
          />
        ) : (
          <div className="flex h-full min-h-[88px] w-full items-center justify-center">
            <MapPin
              className={cn(
                'size-8',
                outbound ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}
              aria-hidden
            />
          </div>
        )}
      </div>
    </MapCardChrome>
  );
}
