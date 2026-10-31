import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

export type SetupGuideSaveHandler = (() => Promise<boolean>) | null;

/** What the overlay needs to protect unsaved edits in the active step. */
export type SetupGuideStepGuard = {
  isDirty: boolean;
  /** The step's controller already registers its own route guard; skip a second one. */
  selfGuarded?: boolean;
  /** "Save & leave" action when it differs from the step's Save & continue handler. */
  onSave?: () => Promise<boolean>;
};

type StepGuardState = Pick<SetupGuideStepGuard, 'isDirty' | 'selfGuarded'>;

type RegisterSave = (
  handler: SetupGuideSaveHandler,
  guard?: (StepGuardState & { onSave?: () => Promise<boolean> }) | null
) => void;

const SetupGuideSaveContext = createContext<{
  registerSave: RegisterSave;
} | null>(null);

export function SetupGuideSaveProvider({
  children,
  registerSave,
}: {
  children: ReactNode;
  registerSave: RegisterSave;
}) {
  const value = useMemo(() => ({ registerSave }), [registerSave]);
  return <SetupGuideSaveContext.Provider value={value}>{children}</SetupGuideSaveContext.Provider>;
}

export function useRegisterStepSave(handler: SetupGuideSaveHandler, guard?: SetupGuideStepGuard) {
  const ctx = useContext(SetupGuideSaveContext);
  const guardRef = useRef(guard);
  guardRef.current = guard;
  const isDirty = guard?.isDirty ?? false;
  const selfGuarded = guard?.selfGuarded ?? false;
  const hasGuard = guard !== undefined;
  useEffect(() => {
    ctx?.registerSave(
      handler,
      hasGuard
        ? {
            isDirty,
            selfGuarded,
            onSave: () => (guardRef.current?.onSave ?? handler)?.() ?? Promise.resolve(true),
          }
        : null
    );
    return () => ctx?.registerSave(null, null);
  }, [ctx, handler, hasGuard, isDirty, selfGuarded]);
}

export function useSetupGuideSaveBridge() {
  const handlerRef = useRef<SetupGuideSaveHandler>(null);
  const [hasSave, setHasSave] = useState(false);
  const guardSaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const [guard, setGuard] = useState<StepGuardState | null>(null);

  const registerSave = useCallback<RegisterSave>((handler, nextGuard) => {
    handlerRef.current = handler;
    guardSaveRef.current = nextGuard?.onSave ?? null;
    setHasSave(Boolean(handler));
    setGuard((current) => {
      if (!nextGuard) return current === null ? current : null;
      const isDirty = nextGuard.isDirty;
      const selfGuarded = Boolean(nextGuard.selfGuarded);
      if (current && current.isDirty === isDirty && Boolean(current.selfGuarded) === selfGuarded) {
        return current;
      }
      return { isDirty, selfGuarded };
    });
  }, []);

  const runGuardSave = useCallback(async () => {
    if (guardSaveRef.current) return guardSaveRef.current();
    if (!handlerRef.current) return true;
    return handlerRef.current();
  }, []);

  const runSave = useCallback(async () => {
    if (!handlerRef.current) return true;
    return handlerRef.current();
  }, []);

  return { registerSave, runSave, runGuardSave, hasSave, guard };
}
