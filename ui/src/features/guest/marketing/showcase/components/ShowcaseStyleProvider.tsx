import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  resolveShowcaseBodyScaleClass,
  resolveShowcaseDisplayFontClass,
  resolveShowcaseHeadingScaleClass,
  resolveShowcaseRevealDuration,
} from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import type { PropertyShowcaseConfig } from '@/features/guest/marketing/showcase/types/showcase';

type ShowcaseStyleContextValue = {
  displayFontClass: string;
  headingScaleClass: string;
  bodyScaleClass: string;
  revealDuration: number;
};

const ShowcaseStyleContext = createContext<ShowcaseStyleContextValue | null>(null);

export { ShowcaseStyleContext };

export function ShowcaseStyleProvider({
  config,
  children,
}: {
  config: PropertyShowcaseConfig;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      displayFontClass: resolveShowcaseDisplayFontClass(config),
      headingScaleClass: resolveShowcaseHeadingScaleClass(config.typography.scale),
      bodyScaleClass: resolveShowcaseBodyScaleClass(config.typography.scale),
      revealDuration: resolveShowcaseRevealDuration(config.motion.intensity),
    }),
    [config]
  );

  return <ShowcaseStyleContext.Provider value={value}>{children}</ShowcaseStyleContext.Provider>;
}

export function useShowcaseStyle(): ShowcaseStyleContextValue {
  const ctx = useContext(ShowcaseStyleContext);
  if (!ctx) {
    throw new Error('useShowcaseStyle must be used within ShowcaseStyleProvider');
  }
  return ctx;
}
