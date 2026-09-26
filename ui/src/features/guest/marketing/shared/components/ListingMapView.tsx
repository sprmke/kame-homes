import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MapPin, Minus, Plus, Star, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';
import {
  listingMapCanvasClass,
  listingMapMinHeightClass,
} from '@/features/guest/marketing/shared/lib/listingMapLayout';
import {
  formatMapPinLabel,
  type ListingMapMarker,
  type MapBbox,
} from '@/features/guest/marketing/shared/lib/listingMapMarkers';
import { resolveListingCoverImage } from '@/features/guest/marketing/shared/lib/mockListingImages';

import { Skeleton } from '@/components/ui/skeleton';
import { useGoogleMapsLoader } from '@/lib/google-maps/useGoogleMapsLoader';
import { cn } from '@/lib/utils';

type ListingMapViewProps = {
  markers: ListingMapMarker[];
  /** Total matching in current mode (may exceed markers.length when capped). */
  totalInView: number;
  nounSingular: string;
  nounPlural: string;
  className?: string;
  /**
   * Viewport the map opens at, read from the URL bounds. While set, the map never
   * re-frames itself on data changes — the guest's viewport is the source of truth.
   */
  initialBbox?: MapBbox | null;
  /** In-bounds results are refetching; pins stay put while the badge shows activity. */
  loading?: boolean;
  /**
   * Called once the map settles after a guest pan/zoom so the parent can refetch
   * in-bounds listings. Never fires for programmatic framing.
   */
  onViewportChange?: (bbox: MapBbox) => void;
  /** Drops the URL bounds and re-frames on the full result set. */
  onResetViewport?: () => void;
};

type MapPin = {
  key: string;
  lat: number;
  lng: number;
  markers: ListingMapMarker[];
};

const PH_DEFAULT_CENTER = { lat: 12.8797, lng: 121.774 };
const PH_DEFAULT_ZOOM = 6;
const SINGLE_LISTING_ZOOM = 15;
/** Street-level ceiling: tighter bounds carry no map detail, only confusion. */
const MAX_OPEN_ZOOM = 17;
/** Past this, zooming can no longer pull apart pins that share an address. */
const MAX_DETAIL_ZOOM = 19;
const CLUSTER_CELL_PX = 52;
const OFFSCREEN = 'translate3d(-9999px, -9999px, 0)';

function readBounds(map: google.maps.Map): MapBbox | null {
  const bounds = map.getBounds();
  if (!bounds) return null;
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return { swLat: sw.lat(), swLng: sw.lng(), neLat: ne.lat(), neLng: ne.lng() };
}

function bboxKey(bbox: MapBbox): string {
  return [bbox.swLat, bbox.swLng, bbox.neLat, bbox.neLng].map((n) => n.toFixed(5)).join(',');
}

function toLatLngBounds(bbox: MapBbox): google.maps.LatLngBounds {
  return new google.maps.LatLngBounds(
    { lat: bbox.swLat, lng: bbox.swLng },
    { lat: bbox.neLat, lng: bbox.neLng }
  );
}

/**
 * Buckets markers into fixed screen-pixel cells using the zoom-independent world
 * projection, so a pan never reshuffles clusters — only a zoom change does.
 */
function buildPins(
  markers: ListingMapMarker[],
  zoom: number | null,
  projection: google.maps.Projection | null
): MapPin[] {
  const singles = () =>
    markers.map((marker) => ({
      key: marker.id,
      lat: marker.latitude,
      lng: marker.longitude,
      markers: [marker],
    }));

  if (markers.length < 2) return singles();
  if (!projection || zoom == null) return singles();

  const scale = 2 ** zoom;
  const cells = new Map<string, ListingMapMarker[]>();

  for (const marker of markers) {
    const point = projection.fromLatLngToPoint(
      new google.maps.LatLng(marker.latitude, marker.longitude)
    );
    const cell = point
      ? `${Math.floor((point.x * scale) / CLUSTER_CELL_PX)}:${Math.floor((point.y * scale) / CLUSTER_CELL_PX)}`
      : marker.id;
    const bucket = cells.get(cell);
    if (bucket) bucket.push(marker);
    else cells.set(cell, [marker]);
  }

  const pins: MapPin[] = [];
  for (const group of cells.values()) {
    if (group.length === 1) {
      const marker = group[0]!;
      pins.push({
        key: marker.id,
        lat: marker.latitude,
        lng: marker.longitude,
        markers: group,
      });
      continue;
    }
    const ids = group.map((m) => m.id).sort();
    pins.push({
      key: `cluster:${ids[0]}:${group.length}`,
      lat: group.reduce((sum, m) => sum + m.latitude, 0) / group.length,
      lng: group.reduce((sum, m) => sum + m.longitude, 0) / group.length,
      markers: group,
    });
  }
  return pins;
}

function ListingMapCard({ listing, onClose }: { listing: ListingMapMarker; onClose: () => void }) {
  return (
    <>
      <div className="relative aspect-[16/10]">
        <Image
          src={resolveListingCoverImage(
            listing.images,
            listing.images?.[0],
            listing.family,
            listing.slug
          )}
          alt={listing.name}
          fill
          className="object-cover"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-slate-900" aria-hidden />
        </button>
      </div>
      <Link to={listing.href as never} className="block p-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h4 className="text-foreground line-clamp-1 font-semibold">{listing.name}</h4>
          {listing.rating != null && listing.rating > 0 ? (
            <div className="flex shrink-0 items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
              <span className="font-medium tabular-nums">{listing.rating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>
        <p className="text-muted-foreground mb-2 line-clamp-1 text-sm">{listing.location}</p>
        {listing.price != null ? (
          <div>
            <span className="text-foreground font-bold tabular-nums">
              ₱{listing.price.toLocaleString()}
            </span>
            {listing.family === 'property' || listing.family === 'parking' ? (
              <span className="text-muted-foreground text-sm"> / night</span>
            ) : null}
          </div>
        ) : null}
      </Link>
    </>
  );
}

/** Listings that share an address — a zoom can never separate them, so list them. */
function ListingMapStack({
  listings,
  nounPlural,
  onClose,
}: {
  listings: ListingMapMarker[];
  nounPlural: string;
  onClose: () => void;
}) {
  return (
    <>
      <div className="border-border flex items-center justify-between gap-2 border-b pl-3">
        <p className="text-foreground text-sm font-semibold tabular-nums">
          {listings.length} {nounPlural} here
        </p>
        <button
          type="button"
          onClick={onClose}
          className="hover:bg-muted flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="divide-border max-h-72 divide-y overflow-y-auto">
        {listings.map((listing) => (
          <li key={listing.id}>
            <Link
              to={listing.href as never}
              className="hover:bg-muted flex min-h-[44px] items-center gap-3 p-3"
            >
              <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md">
                <Image
                  src={resolveListingCoverImage(
                    listing.images,
                    listing.images?.[0],
                    listing.family,
                    listing.slug
                  )}
                  alt={listing.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground line-clamp-1 text-sm font-medium">{listing.name}</p>
                <p className="text-muted-foreground line-clamp-1 text-xs">{listing.location}</p>
              </div>
              {listing.price != null ? (
                <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                  ₱{listing.price.toLocaleString()}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ListingMapView({
  markers,
  totalInView,
  nounSingular,
  nounPlural,
  className,
  initialBbox = null,
  loading = false,
  onViewportChange,
  onResetViewport,
}: ListingMapViewProps) {
  const { ready, error, apiKeyConfigured } = useGoogleMapsLoader();
  const reduceMotion = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const pinElsRef = useRef(new Map<string, HTMLElement>());

  const [pinLayer, setPinLayer] = useState<HTMLDivElement | null>(null);
  const previousBoundsKeyRef = useRef('');
  const [zoom, setZoom] = useState<number | null>(null);
  /** Bumped once the map projection exists so clustering can recompute. */
  const [projectionEpoch, setProjectionEpoch] = useState(0);
  /** Open card: one listing, or every listing sharing a pin. */
  const [selection, setSelection] = useState<ListingMapMarker[]>([]);

  /** A guest gesture happened; the next settle is theirs to publish. */
  const gestureRef = useRef(false);
  const lastEmittedRef = useRef('');
  const framedBoundsRef = useRef('');
  const framedMarkersRef = useRef('');

  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  /**
   * Callers rebuild marker arrays on every render; hold the previous array while the
   * listings themselves are unchanged so pins are never torn down mid-interaction.
   */
  const signature = markers.map((m) => `${m.id}:${m.price ?? ''}`).join('|');
  const signatureRef = useRef(signature);
  const stableMarkersRef = useRef(markers);
  if (signatureRef.current !== signature) {
    signatureRef.current = signature;
    stableMarkersRef.current = markers;
  }
  const stableMarkers = stableMarkersRef.current;

  const initialBboxKey = initialBbox ? bboxKey(initialBbox) : '';
  const initialBboxRef = useRef(initialBbox);
  initialBboxRef.current = initialBbox;

  const pins = useMemo(
    () => buildPins(stableMarkers, zoom, mapRef.current?.getProjection() ?? null),
    // Projection arrives asynchronously; the epoch re-runs clustering once it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableMarkers, zoom, projectionEpoch]
  );
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  const positionPins = useCallback(() => {
    const projection = overlayRef.current?.getProjection();
    if (!projection) return;
    for (const pin of pinsRef.current) {
      const el = pinElsRef.current.get(pin.key);
      if (!el) continue;
      const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(pin.lat, pin.lng));
      if (!point) continue;
      el.style.transform = `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0)`;
    }
  }, []);

  const markGesture = useCallback(() => {
    gestureRef.current = true;
  }, []);

  /**
   * Frames URL bounds, clamping bounds so tight that the map would show nothing but
   * empty canvas. A clamp widens the visible area, so it publishes the corrected
   * bounds once — the listing set and the map always describe the same place.
   */
  const frameBounds = useCallback((bbox: MapBbox) => {
    const map = mapRef.current;
    if (!map) return;
    gestureRef.current = false;
    map.fitBounds(toLatLngBounds(bbox), 0);
    if ((map.getZoom() ?? 0) > MAX_OPEN_ZOOM) {
      map.setZoom(MAX_OPEN_ZOOM);
      gestureRef.current = true;
    }
  }, []);

  /**
   * The map instance outlives every data change: it is created once per mount and
   * reads live props through refs, so a refetch can never reset the viewport.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!ready || !container || mapRef.current) return;

    const opening = initialBboxRef.current;
    const map = new google.maps.Map(container, {
      center: PH_DEFAULT_CENTER,
      zoom: PH_DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      clickableIcons: false,
      gestureHandling: 'greedy',
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    });
    mapRef.current = map;

    if (opening) {
      const key = bboxKey(opening);
      framedBoundsRef.current = key;
      previousBoundsKeyRef.current = key;
      lastEmittedRef.current = key;
      frameBounds(opening);
      google.maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) <= MAX_OPEN_ZOOM) return;
        map.setZoom(MAX_OPEN_ZOOM);
        gestureRef.current = true;
      });
    }

    const layer = document.createElement('div');
    layer.style.position = 'absolute';
    layer.style.top = '0';
    layer.style.left = '0';
    layer.style.pointerEvents = 'none';

    const overlay = new google.maps.OverlayView();
    overlay.onAdd = function onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(layer);
    };
    overlay.draw = () => positionPins();
    overlay.onRemove = () => layer.remove();
    overlay.setMap(map);
    overlayRef.current = overlay;
    setPinLayer(layer);

    const listeners = [
      map.addListener('projection_changed', () => setProjectionEpoch((n) => n + 1)),
      map.addListener('zoom_changed', () => setZoom(map.getZoom() ?? null)),
      map.addListener('idle', () => {
        setZoom(map.getZoom() ?? null);
        positionPins();

        if (!gestureRef.current) return;
        const bbox = readBounds(map);
        if (!bbox) return;
        const key = bboxKey(bbox);
        if (key === lastEmittedRef.current) return;
        gestureRef.current = false;
        lastEmittedRef.current = key;
        setSelection([]);
        onViewportChangeRef.current?.(bbox);
      }),
    ];

    container.addEventListener('pointerdown', markGesture, { passive: true });
    container.addEventListener('wheel', markGesture, { passive: true });
    container.addEventListener('dblclick', markGesture);
    container.addEventListener('keydown', markGesture);

    return () => {
      container.removeEventListener('pointerdown', markGesture);
      container.removeEventListener('wheel', markGesture);
      container.removeEventListener('dblclick', markGesture);
      container.removeEventListener('keydown', markGesture);
      for (const listener of listeners) google.maps.event.removeListener(listener);
      overlay.setMap(null);
      google.maps.event.clearInstanceListeners(map);
      overlayRef.current = null;
      mapRef.current = null;
      setPinLayer(null);
    };
  }, [ready, markGesture, positionPins, frameBounds]);

  /**
   * Framing runs only when nobody owns the viewport yet: URL bounds win over the
   * result set, and a viewport the guest just published is never re-framed.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const droppedBounds = previousBoundsKeyRef.current !== '' && initialBboxKey === '';
    previousBoundsKeyRef.current = initialBboxKey;
    if (droppedBounds) framedMarkersRef.current = '';

    if (initialBboxKey) {
      if (initialBboxKey === framedBoundsRef.current) return;
      framedBoundsRef.current = initialBboxKey;
      if (initialBboxKey === lastEmittedRef.current) return;
      const bbox = initialBboxRef.current;
      if (bbox) frameBounds(bbox);
      return;
    }

    framedBoundsRef.current = '';
    if (signature === framedMarkersRef.current) return;
    framedMarkersRef.current = signature;
    gestureRef.current = false;

    const bounds = new google.maps.LatLngBounds();
    for (const marker of stableMarkers) {
      bounds.extend({ lat: marker.latitude, lng: marker.longitude });
    }
    // Fitting an empty box lands the camera on null island, so fall back to the country.
    if (bounds.isEmpty()) {
      map.setCenter(PH_DEFAULT_CENTER);
      map.setZoom(PH_DEFAULT_ZOOM);
      return;
    }
    map.fitBounds(bounds, 64);
    if ((map.getZoom() ?? 0) > MAX_OPEN_ZOOM || stableMarkers.length === 1) {
      map.setZoom(SINGLE_LISTING_ZOOM);
    }
  }, [initialBboxKey, signature, stableMarkers, pinLayer, frameBounds]);

  useLayoutEffect(() => {
    positionPins();
  }, [pins, positionPins]);

  const registerPin = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) pinElsRef.current.set(key, el);
      else pinElsRef.current.delete(key);
    },
    []
  );

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    markGesture();
    map.setZoom((map.getZoom() ?? PH_DEFAULT_ZOOM) + delta);
  };

  /**
   * Zooming separates listings that merely sit close together. Listings that share an
   * address never separate, so those open as a list instead of a dead zoom-in.
   */
  const openCluster = (pin: MapPin) => {
    const map = mapRef.current;
    if (!map) return;
    const places = new Set(
      pin.markers.map((m) => `${m.latitude.toFixed(5)},${m.longitude.toFixed(5)}`)
    );
    if (places.size > 1 && (map.getZoom() ?? PH_DEFAULT_ZOOM) < MAX_DETAIL_ZOOM) {
      markGesture();
      const bounds = new google.maps.LatLngBounds();
      for (const marker of pin.markers) {
        bounds.extend({ lat: marker.latitude, lng: marker.longitude });
      }
      map.fitBounds(bounds, 72);
      return;
    }
    gestureRef.current = false;
    setSelection(pin.markers);
  };

  const locatedCount = stableMarkers.length;
  const noun = totalInView === 1 ? nounSingular : nounPlural;
  const showEmptyArea = ready && locatedCount === 0 && !loading;

  if (!apiKeyConfigured || error) {
    return (
      <div
        className={cn(
          'border-border bg-muted flex w-full items-center justify-center rounded-2xl border p-6 text-center',
          listingMapMinHeightClass,
          className
        )}
      >
        <p className="text-muted-foreground text-sm">
          {error ?? 'Add VITE_GOOGLE_MAPS_API_KEY to enable map view.'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-border bg-muted relative overflow-hidden rounded-2xl border',
        listingMapCanvasClass,
        className
      )}
    >
      <div ref={containerRef} className="absolute inset-0" role="presentation" />

      {pinLayer
        ? createPortal(
            <>
              {pins.map((pin) => {
                const single = pin.markers.length === 1 ? pin.markers[0]! : null;
                const active = pin.markers.some((m) => selection.some((s) => s.id === m.id));
                return (
                  <div
                    key={pin.key}
                    ref={registerPin(pin.key)}
                    className="absolute left-0 top-0"
                    style={{ transform: OFFSCREEN, pointerEvents: 'auto' }}
                  >
                    {single ? (
                      <button
                        type="button"
                        onClick={() => {
                          // Opening a card is not a viewport change.
                          gestureRef.current = false;
                          setSelection([single]);
                        }}
                        aria-label={`${single.name}, ${single.location}`}
                        className={cn(
                          'border-border bg-background text-foreground -translate-x-1/2 -translate-y-full cursor-pointer',
                          'rounded-full border px-2.5 py-1.5 text-sm font-semibold tabular-nums shadow-md',
                          'focus-visible:ring-primary transition-colors focus-visible:outline-none focus-visible:ring-2',
                          active && 'bg-primary text-primary-foreground border-primary'
                        )}
                      >
                        {formatMapPinLabel(single.price, single.name)}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openCluster(pin)}
                        aria-label={`${pin.markers.length} ${nounPlural} here`}
                        className={cn(
                          'bg-primary text-primary-foreground border-primary/60 cursor-pointer',
                          'flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center',
                          'rounded-full border text-sm font-bold tabular-nums shadow-md',
                          'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2'
                        )}
                      >
                        {pin.markers.length}
                      </button>
                    )}
                  </div>
                );
              })}
            </>,
            pinLayer
          )
        : null}

      {!ready && (
        <Skeleton
          className="absolute inset-0 z-10 rounded-none"
          aria-busy="true"
          aria-label="Loading map"
        />
      )}

      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2 sm:left-4 sm:top-4">
        <div className="border-border bg-background/95 flex items-center gap-2 rounded-full border px-3 py-2 text-sm shadow-md backdrop-blur-sm">
          {loading ? (
            <Skeleton className="size-4 shrink-0 rounded-full" aria-hidden />
          ) : (
            <MapPin className="text-primary h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="text-foreground font-medium tabular-nums" aria-live="polite">
            {locatedCount}
            {totalInView > locatedCount ? `/${totalInView}` : ''} {noun}
          </span>
        </div>
        {initialBbox && onResetViewport ? (
          <button
            type="button"
            onClick={onResetViewport}
            className="border-border bg-background/95 text-foreground hover:bg-muted cursor-pointer rounded-full border px-3 py-2 text-sm font-medium shadow-md backdrop-blur-sm"
          >
            Reset area
          </button>
        ) : null}
      </div>

      <div className="border-border bg-background absolute right-3 top-3 z-20 flex flex-col overflow-hidden rounded-lg border shadow-md sm:right-4 sm:top-4">
        <button
          type="button"
          className="hover:bg-muted flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center"
          aria-label="Zoom in"
          onClick={() => zoomBy(1)}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <div className="bg-border h-px" />
        <button
          type="button"
          className="hover:bg-muted flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center"
          aria-label="Zoom out"
          onClick={() => zoomBy(-1)}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {showEmptyArea ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="border-border bg-background/95 pointer-events-auto max-w-xs rounded-xl border p-4 text-center shadow-lg backdrop-blur-sm">
            <p className="text-foreground text-sm font-medium">No {nounPlural} in this area</p>
            {onResetViewport ? (
              <button
                type="button"
                onClick={onResetViewport}
                className="text-primary mt-2 min-h-[44px] cursor-pointer text-sm font-semibold underline-offset-4 hover:underline"
              >
                Reset area
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {selection.length > 0 ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 16 }}
            className="absolute bottom-3 left-3 right-3 z-30 sm:bottom-4 sm:left-auto sm:right-4 sm:w-80"
          >
            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xl">
              {selection.length === 1 ? (
                <ListingMapCard listing={selection[0]!} onClose={() => setSelection([])} />
              ) : (
                <ListingMapStack
                  listings={selection}
                  nounPlural={nounPlural}
                  onClose={() => setSelection([])}
                />
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
