import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import {
  getAppModeFromPath,
  isHostAuthPath,
  resolveModeSwitchPath,
  type AppMode,
} from '@/features/guest/auth/config/mode-switch';

import { useTheme } from '@/components/theme/ThemeProvider';
import { platformWordmarkParts } from '@/lib/platformBranding';
import {
  resolveBrandTransitionGradientStops,
  resolveBrandWordmarkTextColors,
} from '@/lib/theme/brandColor';
import { cn } from '@/lib/utils';

// Curtain close/open duration must match the `.mode-transition-curtain` transition in index.css.
const WIPE_MS = 500;
// Dwell while fully covered — long enough for the wordmark to settle before the reveal.
const HOLD_MS = 350;
// Host auth screens redirect immediately after navigation, so skip the dwell/reopen there.
const AUTH_CLEANUP_MS = 200;

type GradientStops = { from: string; to: string };
type WordmarkColors = { primary: string; accent: string };
type OverlayPhase = 'idle' | 'closing' | 'closed' | 'opening';

type MarketingBrandColorContextValue = {
  brandColor: string | null;
  setBrandColor: (hex: string | null) => void;
};

type ModeSwitchTransitionContextValue = {
  switchMode: (target: AppMode, options?: { destination?: string }) => void;
  isTransitioning: boolean;
};

const MarketingBrandColorContext = createContext<MarketingBrandColorContextValue | null>(null);
const ModeSwitchTransitionContext = createContext<ModeSwitchTransitionContextValue | null>(null);

export function useMarketingBrandColor(): MarketingBrandColorContextValue {
  const ctx = useContext(MarketingBrandColorContext);
  if (!ctx) {
    throw new Error('useMarketingBrandColor must be used within ModeSwitchTransitionProvider');
  }
  return ctx;
}

export function useModeSwitchTransition(): ModeSwitchTransitionContextValue {
  const ctx = useContext(ModeSwitchTransitionContext);
  if (!ctx) {
    throw new Error('useModeSwitchTransition must be used within ModeSwitchTransitionProvider');
  }
  return ctx;
}

function ModeTransitionOverlay({
  phase,
  stops,
  textColors,
}: {
  phase: OverlayPhase;
  stops: GradientStops | null;
  textColors: WordmarkColors | null;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const gradientStops = useMemo(
    () => stops ?? resolveBrandTransitionGradientStops(null, isDark),
    [stops, isDark]
  );
  const wordmarkColors = useMemo(
    () => textColors ?? resolveBrandWordmarkTextColors(null, isDark),
    [textColors, isDark]
  );
  const wordmark = platformWordmarkParts();

  return (
    <div
      id="mode-transition-overlay"
      className={cn(
        'pointer-events-none fixed inset-0 z-[100]',
        phase !== 'idle' && cn('pointer-events-auto', `is-${phase}`)
      )}
    >
      <div
        className="mode-transition-curtain absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(135deg, ${gradientStops.from}, ${gradientStops.to})`,
        }}
        aria-hidden
      />
      {wordmark ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-[0.15em] text-2xl font-extrabold tracking-tight sm:text-3xl"
          aria-hidden
        >
          <span
            className="mode-transition-word mode-transition-word--kame"
            style={{ color: wordmarkColors.primary }}
          >
            {wordmark.primary}
          </span>
          {wordmark.accent ? (
            <span
              className="mode-transition-word mode-transition-word--homes"
              style={{ color: wordmarkColors.accent }}
            >
              {wordmark.accent}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ModeSwitchTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { resolvedTheme } = useTheme();
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [overlayPhase, setOverlayPhase] = useState<OverlayPhase>('idle');
  const [overlayStops, setOverlayStops] = useState<GradientStops | null>(null);
  const [overlayTextColors, setOverlayTextColors] = useState<WordmarkColors | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const switchMode = useCallback(
    async (target: AppMode, options?: { destination?: string }) => {
      const currentMode = getAppModeFromPath(pathname);
      if (target === currentMode || isTransitioning) return;

      const isDark = resolvedTheme === 'dark';
      const wasAuthPath = isHostAuthPath(pathname);

      setOverlayStops(resolveBrandTransitionGradientStops(brandColor, isDark));
      setOverlayTextColors(resolveBrandWordmarkTextColors(brandColor, isDark));
      setIsTransitioning(true);
      setOverlayPhase('closing');

      await new Promise((resolve) => setTimeout(resolve, WIPE_MS));
      setOverlayPhase('closed');

      const nextPath = options?.destination ?? resolveModeSwitchPath(target, pathname, '/org');
      navigate(nextPath);

      // Host auth screens redirect on their own right after navigation — skip the dwell/reopen beat.
      await new Promise((resolve) => setTimeout(resolve, wasAuthPath ? 0 : HOLD_MS));
      setOverlayPhase('opening');

      setTimeout(
        () => {
          setOverlayPhase('idle');
          setOverlayStops(null);
          setOverlayTextColors(null);
          setIsTransitioning(false);
        },
        wasAuthPath ? AUTH_CLEANUP_MS : WIPE_MS
      );
    },
    [brandColor, isTransitioning, navigate, pathname, resolvedTheme]
  );

  const brandColorValue = useMemo(() => ({ brandColor, setBrandColor }), [brandColor]);

  const transitionValue = useMemo(
    () => ({ switchMode, isTransitioning }),
    [switchMode, isTransitioning]
  );

  return (
    <MarketingBrandColorContext.Provider value={brandColorValue}>
      <ModeSwitchTransitionContext.Provider value={transitionValue}>
        {children}
        <ModeTransitionOverlay
          phase={overlayPhase}
          stops={overlayStops}
          textColors={overlayTextColors}
        />
      </ModeSwitchTransitionContext.Provider>
    </MarketingBrandColorContext.Provider>
  );
}
