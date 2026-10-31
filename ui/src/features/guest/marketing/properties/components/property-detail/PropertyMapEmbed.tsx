import { useEffect, useRef } from 'react';

import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

import {
  hasPropertyMapCoordinates,
  resolvePropertyMapEmbedSrc,
  type PropertyMapEmbedInput,
} from '@/features/guest/marketing/properties/lib/propertyMapEmbed';

import { useTheme } from '@/components/theme/ThemeProvider';
import { getGoogleMapsApiKey, useGoogleMapsLoader } from '@/lib/google-maps/useGoogleMapsLoader';
import { cn } from '@/lib/utils';

type PropertyMapEmbedProps = PropertyMapEmbedInput & {
  className?: string;
};

type InteractiveMapProps = {
  latitude: number;
  longitude: number;
  colorScheme: 'light' | 'dark';
  className?: string;
};

function PropertyMapPlaceholder() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-900">
      <svg className="absolute inset-0 h-full w-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="location-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-primary/20"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#location-grid)" />
      </svg>

      <div className="absolute bottom-0 left-0 h-1/3 w-1/2 rounded-tr-full bg-blue-200/50 dark:bg-blue-900/30" />
      <div className="absolute right-1/4 top-1/4 h-20 w-20 rounded-full bg-green-200/50 dark:bg-green-900/30" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.3 }}
          className="relative"
        >
          <div className="absolute -bottom-2 left-1/2 h-4 w-8 -translate-x-1/2 rounded-full bg-black/20 blur-sm" />
          <div className="bg-primary relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <motion.div
            className="bg-primary absolute inset-0 rounded-full"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      </div>
    </div>
  );
}

function PropertyGoogleInteractiveMap({
  latitude,
  longitude,
  colorScheme,
  className,
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    void (async () => {
      const { ColorScheme } = (await google.maps.importLibrary('core')) as google.maps.CoreLibrary;
      if (cancelled || !containerRef.current) return;

      const map = new google.maps.Map(containerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        colorScheme: colorScheme === 'dark' ? ColorScheme.DARK : ColorScheme.LIGHT,
      });

      new google.maps.Marker({
        map,
        position: { lat: latitude, lng: longitude },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, colorScheme]);

  return <div ref={containerRef} className={className ?? 'absolute inset-0 h-full w-full'} />;
}

function PropertyMapIframe({
  embedSrc,
  isDark,
  className,
}: {
  embedSrc: string;
  isDark: boolean;
  className?: string;
}) {
  return (
    <iframe
      title="Property location map"
      src={embedSrc}
      className={cn(
        className ?? 'absolute inset-0 h-full w-full border-0',
        isDark && 'property-map-embed-dark'
      )}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}

export function PropertyMapEmbed({
  latitude,
  longitude,
  address,
  placeId,
  className,
}: PropertyMapEmbedProps) {
  const { resolvedTheme } = useTheme();
  const { ready, error } = useGoogleMapsLoader();
  const hasCoords = hasPropertyMapCoordinates(latitude, longitude);
  const useInteractiveGoogle = Boolean(getGoogleMapsApiKey()) && hasCoords;

  if (useInteractiveGoogle) {
    if (!ready && !error) {
      return <PropertyMapPlaceholder />;
    }

    if (ready && latitude != null && longitude != null) {
      return (
        <PropertyGoogleInteractiveMap
          latitude={latitude}
          longitude={longitude}
          colorScheme={resolvedTheme}
          className={className}
        />
      );
    }
  }

  const embedSrc = resolvePropertyMapEmbedSrc({ latitude, longitude, address, placeId });

  if (!embedSrc) {
    return <PropertyMapPlaceholder />;
  }

  return (
    <PropertyMapIframe
      embedSrc={embedSrc}
      isDark={resolvedTheme === 'dark'}
      className={className}
    />
  );
}
