import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type MarketingStudioHeaderActionsContextValue = {
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
};

const MarketingStudioHeaderActionsContext =
  createContext<MarketingStudioHeaderActionsContextValue | null>(null);

export function MarketingStudioHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null);
  // Stable setter — must not change when `actions` updates, or consumers that
  // put the whole context object in an effect dep array will loop forever.
  const setActions = useCallback((next: ReactNode) => {
    setActionsState((prev) => (Object.is(prev, next) ? prev : next));
  }, []);
  const value = useMemo(() => ({ actions, setActions }), [actions, setActions]);

  return (
    <MarketingStudioHeaderActionsContext.Provider value={value}>
      {children}
    </MarketingStudioHeaderActionsContext.Provider>
  );
}

export function MarketingStudioHeaderActionsSlot() {
  const ctx = useContext(MarketingStudioHeaderActionsContext);
  return ctx?.actions ?? null;
}

/**
 * Register builder toolbar actions in the persistent marketing studio header.
 * Callers must memoize `actions` — unstable trees cause Maximum update depth loops
 * (setActions → provider re-render → new actions identity → setActions…).
 */
export function useMarketingStudioHeaderActions(actions: ReactNode) {
  const ctx = useContext(MarketingStudioHeaderActionsContext);
  const setActions = ctx?.setActions;

  useEffect(() => {
    if (!setActions) return;
    setActions(actions);
  }, [actions, setActions]);

  // Clear only on unmount — not on every actions identity change.
  useEffect(() => {
    if (!setActions) return;
    return () => setActions(null);
  }, [setActions]);
}
