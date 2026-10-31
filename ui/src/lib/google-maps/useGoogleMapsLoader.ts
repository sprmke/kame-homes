import { useEffect, useState } from 'react';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

/** Libraries loaded by map pickers and listing map views. */
export const GOOGLE_MAPS_LIBRARIES_FULL = ['core', 'maps', 'places', 'geocoding'] as const;

/** Places autocomplete only — guest profile location, lighter than full stack. */
export const GOOGLE_MAPS_LIBRARIES_PLACES = ['places'] as const;

export type GoogleMapsLibrary =
  (typeof GOOGLE_MAPS_LIBRARIES_FULL)[number] | (typeof GOOGLE_MAPS_LIBRARIES_PLACES)[number];

const loadedLibraries = new Set<string>();
let optionsConfigured = false;

function getMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';
}

export function getGoogleMapsApiKey(): string {
  return getMapsApiKey();
}

async function loadGoogleMapsLibraries(libraries: readonly GoogleMapsLibrary[]): Promise<void> {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    throw new Error('VITE_GOOGLE_MAPS_API_KEY is not configured');
  }

  if (!optionsConfigured) {
    setOptions({
      key: apiKey,
      v: 'weekly',
    });
    optionsConfigured = true;
  }

  const pending = libraries.filter((name) => !loadedLibraries.has(name));
  if (pending.length === 0) return;

  await Promise.all(pending.map((name) => importLibrary(name)));
  pending.forEach((name) => loadedLibraries.add(name));
}

type UseGoogleMapsLoaderOptions = {
  /** When false, skip loading until re-enabled (e.g. first focus on a search field). */
  enabled?: boolean;
  /** Default: full stack for map embeds / property location picker. */
  libraries?: readonly GoogleMapsLibrary[];
};

export function useGoogleMapsLoader(options: UseGoogleMapsLoaderOptions = {}) {
  const enabled = options.enabled !== false;
  const libraries = options.libraries ?? GOOGLE_MAPS_LIBRARIES_FULL;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (!getMapsApiKey()) {
      return 'Add VITE_GOOGLE_MAPS_API_KEY to enable the map picker.';
    }
    return null;
  });

  useEffect(() => {
    if (!enabled || !getMapsApiKey()) return;

    let cancelled = false;
    loadGoogleMapsLibraries(libraries)
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load Google Maps');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, libraries]);

  return { ready, error, apiKeyConfigured: Boolean(getMapsApiKey()) };
}
