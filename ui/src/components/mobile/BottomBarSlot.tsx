import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { AnimatePresence, motion } from 'framer-motion';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type BottomBarSlotContextValue = {
  setHasContextual: (has: boolean) => void;
  hasContextual: boolean;
};

const BottomBarSlotContext = createContext<BottomBarSlotContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  /** Persistent tab bar (or null when not on a mobile shell). */
  tabBar: ReactNode | null;
  className?: string;
};

/**
 * Single fixed bottom band: either the persistent tab bar or a screen-owned
 * contextual action bar. Screens mount `<ContextualActionBar>` to claim the slot.
 */
export function BottomBarSlotProvider({ children, tabBar, className }: ProviderProps) {
  const [hasContextual, setHasContextual] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const value = useMemo(() => ({ setHasContextual, hasContextual }), [hasContextual]);

  return (
    <BottomBarSlotContext.Provider value={value}>
      {children}
      <div className={cn('lg:hidden', className)}>
        <AnimatePresence mode="wait" initial={false}>
          {!hasContextual && tabBar ? (
            <motion.div
              key="tabs"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {tabBar}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </BottomBarSlotContext.Provider>
  );
}

/** Register that a contextual bar is mounted (hides the tab bar). */
export function useClaimBottomBarSlot() {
  const ctx = useContext(BottomBarSlotContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.setHasContextual(true);
    return () => ctx.setHasContextual(false);
  }, [ctx]);
}

export function useBottomBarSlotHasContextual(): boolean {
  return Boolean(useContext(BottomBarSlotContext)?.hasContextual);
}
