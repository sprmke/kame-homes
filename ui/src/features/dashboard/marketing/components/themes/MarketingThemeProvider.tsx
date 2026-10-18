import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useMarketingPropertyLook } from '@/features/dashboard/marketing/hooks/useMarketingPropertyLook';
import { useMarketingThemes } from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import {
  marketingThemeHash,
  resolveMarketingTheme,
  type ResolvedMarketingTheme,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { loadMarketingFonts } from '@/features/dashboard/marketing/lib/theme/marketingFontLoader';
import { marketingThemeFontList } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';
import { BUILTIN_PROPERTY_COLORS_THEME_KEY } from '@/features/dashboard/marketing/lib/theme/marketingThemeKeys';
import {
  buildMarketingThemeLibrary,
  findMarketingThemeEntry,
  type MarketingThemeEntry,
  type MarketingThemeLibrary,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';
import {
  normalizeMarketingStudioTab,
  readLastMarketingTheme,
  writeLastMarketingTheme,
  type MarketingStudioTab,
} from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export type MarketingStudioView = 'workspace' | 'themes';

type MarketingThemeContextValue = {
  library: MarketingThemeLibrary;
  /** Saved themes still loading (built-ins are always available). */
  libraryLoading: boolean;
  /** Theme for the open workspace. Null only while a saved theme is still loading. */
  active: MarketingThemeEntry | null;
  resolved: ResolvedMarketingTheme | null;
  activeHash: string | null;
  /** Property photos sampled, so Property colors is final (safe to re-theme items). */
  ready: boolean;
  view: MarketingStudioView;
  /** A workspace exists to go back to (not the first-visit picker). */
  hasWorkspace: boolean;
  tab: MarketingStudioTab;
  setTab: (tab: MarketingStudioTab) => void;
  openTheme: (key: string, options?: { tab?: MarketingStudioTab }) => void;
  showThemes: () => void;
  coverPhotoUrl: string | undefined;
  photoUrls: string[];
  brandColor: string;
};

const MarketingThemeContext = createContext<MarketingThemeContextValue | null>(null);

const THEME_PARAM = 'theme';
const TAB_PARAM = 'tab';
const VIEW_PARAM = 'view';

export function MarketingThemeProvider({ children }: { children: ReactNode }) {
  const propertyId = usePropertyIdParam();
  const [searchParams, setSearchParams] = useSearchParams();
  const look = useMarketingPropertyLook();
  const { data, isLoading: libraryLoading, isFetching, isError } = useMarketingThemes();

  const library = useMemo(
    () =>
      buildMarketingThemeLibrary({
        propertyColorsTokens: look.propertyColorsTokens,
        records: data?.themes ?? [],
        itemCounts: data?.itemCounts ?? {},
      }),
    [look.propertyColorsTokens, data]
  );

  const themeParam = searchParams.get(THEME_PARAM);
  const tab = normalizeMarketingStudioTab(searchParams.get(TAB_PARAM));
  const lastTheme = useMemo(() => readLastMarketingTheme(propertyId), [propertyId]);
  // No theme in the URL: reopen the last theme; first visit lands on the theme picker.
  const view: MarketingStudioView =
    searchParams.get(VIEW_PARAM) === 'themes' || (!themeParam && !lastTheme)
      ? 'themes'
      : 'workspace';
  const activeKey = themeParam ?? lastTheme ?? BUILTIN_PROPERTY_COLORS_THEME_KEY;

  const active = findMarketingThemeEntry(library, activeKey);
  // Only fall back once the list is fresh: a just-created theme may still be refetching.
  const settled = (!libraryLoading && !isFetching) || isError;

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void, replace = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  // A deleted / unknown theme: fall back to Property colors once we know for sure.
  const warnedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!settled || active || view === 'themes') return;
    if (warnedKeyRef.current !== activeKey) {
      warnedKeyRef.current = activeKey;
      toast.message('That theme is no longer available. Showing Property colors.');
    }
    updateParams((params) => params.set(THEME_PARAM, BUILTIN_PROPERTY_COLORS_THEME_KEY), true);
  }, [settled, active, activeKey, view, updateParams]);

  // Remember the open theme for next visit (only real, resolvable keys).
  useEffect(() => {
    if (view === 'workspace' && active) writeLastMarketingTheme(propertyId, active.key);
  }, [view, active, propertyId]);

  const resolved = useMemo(() => (active ? resolveMarketingTheme(active.tokens) : null), [active]);
  const activeHash = useMemo(() => (active ? marketingThemeHash(active.tokens) : null), [active]);

  // Theme fonts may not be preloaded (Poppins, Montserrat…): fetch them up front.
  useEffect(() => {
    if (active) void loadMarketingFonts(marketingThemeFontList(active.tokens.fonts));
  }, [active]);

  const setTab = useCallback(
    (next: MarketingStudioTab) => updateParams((params) => params.set(TAB_PARAM, next), true),
    [updateParams]
  );

  const openTheme = useCallback(
    (key: string, options?: { tab?: MarketingStudioTab }) =>
      updateParams((params) => {
        params.set(THEME_PARAM, key);
        params.delete(VIEW_PARAM);
        if (options?.tab) params.set(TAB_PARAM, options.tab);
      }),
    [updateParams]
  );

  const showThemes = useCallback(
    () => updateParams((params) => params.set(VIEW_PARAM, 'themes')),
    [updateParams]
  );

  const value = useMemo<MarketingThemeContextValue>(
    () => ({
      library,
      libraryLoading: libraryLoading && !isError,
      active,
      resolved,
      activeHash,
      ready: look.ready,
      view,
      hasWorkspace: Boolean(themeParam ?? lastTheme),
      tab,
      setTab,
      openTheme,
      showThemes,
      coverPhotoUrl: look.coverPhotoUrl,
      photoUrls: look.photoUrls,
      brandColor: look.brandColor,
    }),
    [
      library,
      libraryLoading,
      isError,
      active,
      resolved,
      activeHash,
      look.ready,
      look.coverPhotoUrl,
      look.photoUrls,
      look.brandColor,
      view,
      themeParam,
      lastTheme,
      tab,
      setTab,
      openTheme,
      showThemes,
    ]
  );

  return <MarketingThemeContext.Provider value={value}>{children}</MarketingThemeContext.Provider>;
}

export function useMarketingTheme(): MarketingThemeContextValue {
  const ctx = useContext(MarketingThemeContext);
  if (!ctx) throw new Error('useMarketingTheme must be used inside MarketingThemeProvider');
  return ctx;
}

/** Editors rendered outside the studio (tests, previews) get `null` instead of throwing. */
export function useOptionalMarketingTheme(): MarketingThemeContextValue | null {
  return useContext(MarketingThemeContext);
}
