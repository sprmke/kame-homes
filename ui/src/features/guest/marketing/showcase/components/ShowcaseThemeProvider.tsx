import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  getShowcaseThemeTokens,
  showcaseThemeStorageKey,
  type ShowcaseColorMode,
  type ShowcaseThemeTokens,
  type ShowcaseVariant,
} from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';

type ShowcaseThemeContextValue = {
  mode: ShowcaseColorMode;
  variant: ShowcaseVariant;
  tokens: ShowcaseThemeTokens;
  toggleMode: () => void;
  setMode: (mode: ShowcaseColorMode) => void;
};

const ShowcaseThemeContext = createContext<ShowcaseThemeContextValue | null>(null);

function readStoredMode(
  propertySlug: string,
  variant: ShowcaseVariant,
  fallback: ShowcaseColorMode
): ShowcaseColorMode {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(showcaseThemeStorageKey(propertySlug, variant));
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function ShowcaseThemeProvider({
  variant,
  propertySlug,
  configControlled = false,
  children,
}: {
  variant: ShowcaseVariant;
  propertySlug: string;
  /** When true (Page Editor preview), toggles apply live but are not persisted for guests. */
  configControlled?: boolean;
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<ShowcaseColorMode>(() =>
    configControlled ? 'light' : readStoredMode(propertySlug, variant, 'light')
  );

  const setMode = useCallback(
    (next: ShowcaseColorMode) => {
      setModeState(next);
      if (configControlled) return;
      try {
        localStorage.setItem(showcaseThemeStorageKey(propertySlug, variant), next);
      } catch {
        /* ignore */
      }
    },
    [configControlled, propertySlug, variant]
  );

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const tokens = useMemo(() => getShowcaseThemeTokens(variant, mode), [variant, mode]);

  const value = useMemo(
    () => ({ mode, variant, tokens, toggleMode, setMode }),
    [mode, variant, tokens, toggleMode, setMode]
  );

  return <ShowcaseThemeContext.Provider value={value}>{children}</ShowcaseThemeContext.Provider>;
}

export function useShowcaseTheme() {
  const ctx = useContext(ShowcaseThemeContext);
  if (!ctx) {
    throw new Error('useShowcaseTheme must be used within ShowcaseThemeProvider');
  }
  return ctx;
}
