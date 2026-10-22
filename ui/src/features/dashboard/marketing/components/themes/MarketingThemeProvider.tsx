import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { toast } from 'sonner';

import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import { useMarketingPropertyLook } from '@/features/dashboard/marketing/hooks/useMarketingPropertyLook';
import { useMarketingThemes } from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import {
  LIBRARY_ENTRY_STATE_KEY,
  OPEN_AI_STATE_KEY,
  applyOpenItem,
  applyStartAiSession,
  applyStartDraft,
  cameFromLibrary,
  clearItemParams,
  readAiOutput,
  readItemState,
  type AiStudioOutput,
  type MarketingStudioItemState,
  type MarketingTemplateRef,
} from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { loadMarketingFonts } from '@/features/dashboard/marketing/lib/theme/marketingFontLoader';
import {
  isMarketingStudioTab,
  readLastMarketingTab,
  readLastMarketingTheme,
  resolveDefaultMarketingStudioTab,
  writeLastMarketingTab,
  writeLastMarketingTheme,
  type MarketingStudioTab,
} from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';
import {
  marketingThemeHash,
  resolveMarketingTheme,
  type ResolvedMarketingTheme,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { marketingThemeFontList } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';
import { BUILTIN_PROPERTY_COLORS_THEME_KEY } from '@/features/dashboard/marketing/lib/theme/marketingThemeKeys';
import {
  buildMarketingThemeLibrary,
  findMarketingThemeEntry,
  type MarketingThemeEntry,
  type MarketingThemeLibrary,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

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
  /** False only while the landing tab waits on plan / permission data (no tab in the URL). */
  tabReady: boolean;
  setTab: (tab: MarketingStudioTab) => void;
  /** Library vs editor (saved item or unsaved draft) for the open tab. */
  item: MarketingStudioItemState;
  /** Open a saved design in the editor (pushes history so Back returns to the Library). */
  openItem: (id: string, options?: { tab?: MarketingStudioTab; replace?: boolean }) => void;
  /** Start an unsaved draft from a template. */
  startDraft: (
    from: MarketingTemplateRef | null,
    options?: {
      size?: string | null;
      tab?: MarketingStudioTab;
      openAi?: boolean;
      /** Swap the open draft's template in place (no new history entry). */
      replace?: boolean;
    }
  ) => void;
  /** AI Studio: output of the new creation being set up (`item=new&output=…`). */
  aiOutput: AiStudioOutput | null;
  /** AI Studio step 2: set up a new post, photo or clip (pushes history). */
  startAiSession: (output: AiStudioOutput, options?: { replace?: boolean }) => void;
  /** A draft was stored: swap `item=new` for its id without a new history entry. */
  replaceDraftWithItem: (id: string) => void;
  /** Leave the editor for the Library. */
  closeItem: () => void;
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
  const location = useLocation();
  const navigate = useNavigate();
  const { canGenerate, canGenerateImage } = useMarketingPermissions();
  const postGate = useFeatureGate('aiMarketingGeneration');
  const imageGate = useFeatureGate('aiMarketingImageGeneration');
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
  const tabParam = searchParams.get(TAB_PARAM);
  const lastTab = useMemo(() => readLastMarketingTab(propertyId), [propertyId]);
  const gatesLoading = postGate.isLoading || imageGate.isLoading;
  const aiAvailable =
    (postGate.allowed && canGenerate) || (imageGate.allowed && (canGenerateImage || canGenerate));
  // The landing tab depends on plan data only when the URL and storage say nothing.
  const tabReady = isMarketingStudioTab(tabParam) || lastTab !== null || !gatesLoading;
  const tab: MarketingStudioTab = isMarketingStudioTab(tabParam)
    ? tabParam
    : resolveDefaultMarketingStudioTab({ lastTab, aiAvailable });
  const item = useMemo(() => readItemState(searchParams), [searchParams]);
  const aiOutput = useMemo(() => readAiOutput(searchParams), [searchParams]);
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

  useEffect(() => {
    if (view === 'workspace' && tabReady) writeLastMarketingTab(propertyId, tab);
  }, [view, tabReady, tab, propertyId]);

  const resolved = useMemo(() => (active ? resolveMarketingTheme(active.tokens) : null), [active]);
  const activeHash = useMemo(() => (active ? marketingThemeHash(active.tokens) : null), [active]);

  // Theme fonts may not be preloaded (Poppins, Montserrat…): fetch them up front.
  useEffect(() => {
    if (active) void loadMarketingFonts(marketingThemeFontList(active.tokens.fonts));
  }, [active]);

  const setTab = useCallback(
    (next: MarketingStudioTab) =>
      updateParams((params) => {
        params.set(TAB_PARAM, next);
        clearItemParams(params);
      }, true),
    [updateParams]
  );

  const openItem = useCallback(
    (id: string, options?: { tab?: MarketingStudioTab; replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (options?.tab) next.set(TAB_PARAM, options.tab);
          applyOpenItem(next, id);
          return next;
        },
        {
          replace: options?.replace ?? false,
          state: { [LIBRARY_ENTRY_STATE_KEY]: true },
        }
      );
    },
    [setSearchParams]
  );

  const startDraft = useCallback(
    (
      from: MarketingTemplateRef | null,
      options?: {
        size?: string | null;
        tab?: MarketingStudioTab;
        openAi?: boolean;
        replace?: boolean;
      }
    ) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (options?.tab) next.set(TAB_PARAM, options.tab);
          applyStartDraft(next, { from, size: options?.size ?? null });
          return next;
        },
        {
          replace: options?.replace ?? false,
          state: options?.replace
            ? { [LIBRARY_ENTRY_STATE_KEY]: cameFromLibrary(location.state) }
            : {
                [LIBRARY_ENTRY_STATE_KEY]: true,
                ...(options?.openAi ? { [OPEN_AI_STATE_KEY]: true } : {}),
              },
        }
      );
    },
    [setSearchParams, location.state]
  );

  const startAiSession = useCallback(
    (output: AiStudioOutput, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(TAB_PARAM, 'generate');
          applyStartAiSession(next, output);
          return next;
        },
        {
          replace: options?.replace ?? false,
          state: options?.replace
            ? { [LIBRARY_ENTRY_STATE_KEY]: cameFromLibrary(location.state) }
            : { [LIBRARY_ENTRY_STATE_KEY]: true },
        }
      );
    },
    [setSearchParams, location.state]
  );

  const replaceDraftWithItem = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          applyOpenItem(next, id);
          return next;
        },
        // Keep the entry state so Back still pops to the Library.
        { replace: true, state: location.state }
      );
    },
    [setSearchParams, location.state]
  );

  const closeItem = useCallback(() => {
    if (cameFromLibrary(location.state)) {
      navigate(-1);
      return;
    }
    updateParams((params) => clearItemParams(params), true);
  }, [location.state, navigate, updateParams]);

  const openTheme = useCallback(
    (key: string, options?: { tab?: MarketingStudioTab }) =>
      updateParams((params) => {
        params.set(THEME_PARAM, key);
        params.delete(VIEW_PARAM);
        // Items belong to one theme: switching themes returns to that tab's Library.
        clearItemParams(params);
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
      tabReady,
      setTab,
      item,
      openItem,
      startDraft,
      aiOutput,
      startAiSession,
      replaceDraftWithItem,
      closeItem,
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
      tabReady,
      setTab,
      item,
      openItem,
      startDraft,
      aiOutput,
      startAiSession,
      replaceDraftWithItem,
      closeItem,
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
