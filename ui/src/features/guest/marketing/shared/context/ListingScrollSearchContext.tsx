import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';

import { createPortal } from 'react-dom';

import {
  HeroSearch,
  type HeroSearchField,
  type HeroSearchValues,
} from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import {
  clamp01,
  easeOutCubic,
  lerp,
  smoothstep,
} from '@/features/guest/marketing/shared/lib/listingScrollSearchEasing';
import type { ListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';

const MORPH_DISTANCE = 168;
/** Fallback when `--public-nav-h` (index.css) can't be read. */
const HEADER_HEIGHT_FALLBACK = 56;
/** Space reserved for logo icon when the wordmark collapses on mobile scroll morph. */
const MOBILE_MORPH_LOGO_SLOT = 68;
const MOBILE_MORPH_MENU_SLOT = 72;
const TABLET_MORPH_LOGO_SLOT = 84;
const TABLET_MORPH_MENU_SLOT = 80;
/** Prevent the touch-first search control from stretching across tablet headers. */
const MOBILE_DOCKED_BAR_MAX_WIDTH = 720;
/** Docked pill height on mobile — centers it in the header row. */
const MOBILE_DOCKED_BAR_HEIGHT = 46;
/** The floater renders at `top-[-3px]`; add it back so the centered value lands true. */
const FLOATER_TOP_OFFSET = 3;
/** Above header shell (z-50), below header overlays like account menus (z-60). */
const SEARCH_FLOATER_Z_CLASS = 'z-[55]';
/** Hero placeholder — compact mobile; taller labeled bar on desktop hero. */
export const LISTING_SEARCH_PLACEHOLDER_HEIGHT_MOBILE = 56;
export const LISTING_SEARCH_PLACEHOLDER_HEIGHT_DESKTOP = 92;

/** Current fixed-nav height in px (56 phone, 64 tablet, 80 desktop) from `--public-nav-h`. */
function readPublicNavHeight(): number {
  const root = document.documentElement;
  const rem = parseFloat(getComputedStyle(root).getPropertyValue('--public-nav-h'));
  const rootPx = parseFloat(getComputedStyle(root).fontSize) || 16;
  return Number.isFinite(rem) && rem > 0 ? rem * rootPx : HEADER_HEIGHT_FALLBACK;
}
const NAV_EXIT_DISTANCE = 32;

type MorphBounds = {
  ready: boolean;
  progress: number;
  navProgress: number;
  compactProgress: number;
  top: number;
  left: number;
  width: number;
  isCompact: boolean;
};

type ListingScrollSearchContextValue = {
  enabled: boolean;
  heroAnchorRef: MutableRefObject<HTMLDivElement | null>;
  headerAnchorRef: MutableRefObject<HTMLDivElement | null>;
  morph: MorphBounds;
  placeholderHeight: number;
  redirectTo: string;
  preferType: ListingSearchPreferType | null;
  defaultLocation: string;
  fields: HeroSearchField[];
  whereLabel: string;
  wherePlaceholder: string;
  whereCompactPlaceholder: string;
  onSearch?: (values: HeroSearchValues) => void;
};

const defaultMorph: MorphBounds = {
  ready: false,
  progress: 0,
  navProgress: 0,
  compactProgress: 0,
  top: 0,
  left: 0,
  width: 0,
  isCompact: false,
};

const ListingScrollSearchContext = createContext<ListingScrollSearchContextValue | null>(null);

function useMorphBounds(
  heroAnchorRef: MutableRefObject<HTMLDivElement | null>,
  headerAnchorRef: MutableRefObject<HTMLDivElement | null>,
  enabled: boolean
): MorphBounds {
  const [bounds, setBounds] = useState<MorphBounds>(defaultMorph);

  useEffect(() => {
    if (!enabled) {
      setBounds(defaultMorph);
      return;
    }

    let raf = 0;
    // Lazy route pages mount the hero anchor after this effect runs; keep polling a few frames
    // so the bar shows on first paint instead of waiting for the first scroll.
    let anchorWaitFrames = 120;

    const update = () => {
      const hero = heroAnchorRef.current;
      const header = headerAnchorRef.current;
      if (!hero) {
        if (anchorWaitFrames-- > 0) raf = requestAnimationFrame(update);
        return;
      }

      const heroRect = hero.getBoundingClientRect();
      const isLg = window.matchMedia('(min-width: 1024px)').matches;
      const headerHeight = readPublicNavHeight();
      const rawProgress = clamp01((headerHeight - heroRect.top) / MORPH_DISTANCE);
      const progress = rawProgress;
      const navProgress = smoothstep(0, 0.34, progress);
      const compactProgress = smoothstep(0.2, 0.74, progress);
      const isCompact = compactProgress > 0.88;

      let top = heroRect.top;
      let left = heroRect.left;
      let width = heroRect.width;

      const positionT = easeOutCubic(smoothstep(0.06, 0.98, progress));

      if (progress > 0) {
        if (isLg && header) {
          const headerRect = header.getBoundingClientRect();
          top = lerp(heroRect.top, headerRect.top, positionT);
          left = lerp(heroRect.left, headerRect.left, positionT);
          width = lerp(heroRect.width, headerRect.width, positionT);
        } else if (!isLg) {
          const headerRect = header?.getBoundingClientRect();
          // The header anchor is `hidden lg:flex`, so below lg its rect is all zeros.
          const endTop =
            headerRect && headerRect.height > 0
              ? headerRect.top
              : (headerHeight - MOBILE_DOCKED_BAR_HEIGHT) / 2 + FLOATER_TOP_OFFSET;
          // clientWidth excludes a desktop scrollbar; innerWidth would dock under it.
          const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
          const usesTabletGutters = viewportWidth >= 640;
          const logoSlot = usesTabletGutters ? TABLET_MORPH_LOGO_SLOT : MOBILE_MORPH_LOGO_SLOT;
          const menuSlot = usesTabletGutters ? TABLET_MORPH_MENU_SLOT : MOBILE_MORPH_MENU_SLOT;
          const availableWidth = viewportWidth - logoSlot - menuSlot;
          const endWidth = Math.min(availableWidth, MOBILE_DOCKED_BAR_MAX_WIDTH);
          const endLeft = logoSlot + Math.max(0, (availableWidth - endWidth) / 2);
          const widthT = easeOutCubic(smoothstep(0.48, 0.98, progress));
          top = lerp(heroRect.top, endTop, positionT);
          left = lerp(heroRect.left, endLeft, widthT);
          width = lerp(heroRect.width, endWidth, widthT);
        } else if (header) {
          const headerRect = header.getBoundingClientRect();
          top = lerp(heroRect.top, headerRect.top, positionT);
          left = lerp(heroRect.left, headerRect.left, positionT);
          width = lerp(heroRect.width, headerRect.width, positionT);
        } else {
          const endTop = headerHeight + 8;
          const endLeft = 16;
          const endWidth = window.innerWidth - 32;
          top = lerp(heroRect.top, endTop, positionT);
          left = lerp(heroRect.left, endLeft, positionT);
          width = lerp(heroRect.width, endWidth, positionT);
        }
      }

      setBounds({
        ready: true,
        progress,
        navProgress,
        compactProgress,
        top,
        left,
        width,
        isCompact,
      });
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    const mq = window.matchMedia('(min-width: 1024px)');
    mq.addEventListener('change', schedule);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      mq.removeEventListener('change', schedule);
    };
  }, [enabled, heroAnchorRef, headerAnchorRef]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const hero = heroAnchorRef.current;
    if (!hero) return;

    const heroRect = hero.getBoundingClientRect();
    setBounds({
      ready: true,
      progress: 0,
      navProgress: 0,
      compactProgress: 0,
      top: heroRect.top,
      left: heroRect.left,
      width: heroRect.width,
      isCompact: false,
    });
  }, [enabled, heroAnchorRef]);

  return bounds;
}

function ListingSearchFloater({
  redirectTo,
  preferType,
  defaultLocation,
  fields,
  whereLabel,
  wherePlaceholder,
  whereCompactPlaceholder,
  onSearch,
}: {
  redirectTo: string;
  preferType: ListingSearchPreferType | null;
  defaultLocation: string;
  fields: HeroSearchField[];
  whereLabel: string;
  wherePlaceholder: string;
  whereCompactPlaceholder: string;
  onSearch?: (values: HeroSearchValues) => void;
}) {
  const { morph } = useListingScrollSearch();

  if (!morph.ready) return null;

  return createPortal(
    <div
      className={`pointer-events-auto fixed left-0 top-[-3px] ${SEARCH_FLOATER_Z_CLASS}`}
      style={{
        transform: `translate3d(${morph.left}px, ${morph.top}px, 0)`,
        width: morph.width,
        willChange: morph.progress > 0 && morph.progress < 1 ? 'transform, width' : undefined,
      }}
    >
      <HeroSearch
        morphProgress={morph.compactProgress}
        scrollProgress={morph.progress}
        redirectTo={redirectTo}
        preferType={preferType}
        defaultLocation={defaultLocation}
        fields={fields}
        whereLabel={whereLabel}
        wherePlaceholder={wherePlaceholder}
        whereCompactPlaceholder={whereCompactPlaceholder}
        onSearch={onSearch}
      />
    </div>,
    document.body
  );
}

type ProviderProps = {
  children: ReactNode;
  enabled: boolean;
  redirectTo: string;
  preferType?: ListingSearchPreferType | null;
  defaultLocation: string;
  fields: HeroSearchField[];
  whereLabel?: string;
  wherePlaceholder?: string;
  whereCompactPlaceholder?: string;
  onSearch?: (values: HeroSearchValues) => void;
};

export function ListingScrollSearchProvider({
  children,
  enabled,
  redirectTo,
  preferType = null,
  defaultLocation,
  fields,
  whereLabel = 'Where',
  wherePlaceholder = 'Search destinations',
  whereCompactPlaceholder = 'Anywhere',
  onSearch,
}: ProviderProps) {
  const heroAnchorRef = useRef<HTMLDivElement | null>(null);
  const headerAnchorRef = useRef<HTMLDivElement | null>(null);
  const morph = useMorphBounds(heroAnchorRef, headerAnchorRef, enabled);

  const value: ListingScrollSearchContextValue = {
    enabled,
    heroAnchorRef,
    headerAnchorRef,
    morph,
    placeholderHeight: LISTING_SEARCH_PLACEHOLDER_HEIGHT_DESKTOP,
    redirectTo,
    preferType,
    defaultLocation,
    fields,
    whereLabel,
    wherePlaceholder,
    whereCompactPlaceholder,
    onSearch,
  };

  return (
    <ListingScrollSearchContext.Provider value={value}>
      {children}
      {enabled ? (
        <ListingSearchFloater
          redirectTo={redirectTo}
          preferType={preferType}
          defaultLocation={defaultLocation}
          fields={fields}
          whereLabel={whereLabel}
          wherePlaceholder={wherePlaceholder}
          whereCompactPlaceholder={whereCompactPlaceholder}
          onSearch={onSearch}
        />
      ) : null}
    </ListingScrollSearchContext.Provider>
  );
}

export function useListingScrollSearch(): ListingScrollSearchContextValue {
  const ctx = useContext(ListingScrollSearchContext);
  if (!ctx) {
    return {
      enabled: false,
      heroAnchorRef: { current: null },
      headerAnchorRef: { current: null },
      morph: defaultMorph,
      placeholderHeight: LISTING_SEARCH_PLACEHOLDER_HEIGHT_DESKTOP,
      redirectTo: '/search',
      preferType: null,
      defaultLocation: '',
      fields: ['where', 'when', 'who'],
      whereLabel: 'Where',
      wherePlaceholder: 'Search destinations',
      whereCompactPlaceholder: 'Anywhere',
    };
  }
  return ctx;
}

export function useListingScrollSearchOptional() {
  return useContext(ListingScrollSearchContext);
}

/** Nav links slide up and fade as the search bar docks (Airbnb-style). */
export function useListingNavMorph(): {
  opacity: number;
  translateY: number;
  progress: number;
} {
  const ctx = useListingScrollSearchOptional();
  if (!ctx?.enabled) {
    return { opacity: 1, translateY: 0, progress: 0 };
  }

  const eased = easeOutCubic(ctx.morph.navProgress);
  return {
    opacity: 1 - eased,
    translateY: -NAV_EXIT_DISTANCE * eased,
    progress: ctx.morph.navProgress,
  };
}

/** @deprecated Use `useListingNavMorph` */
export function useListingNavDockOpacity(): number {
  return useListingNavMorph().opacity;
}
