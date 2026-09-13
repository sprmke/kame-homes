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

const SetupGuideSaveContext = createContext<{
  registerSave: (handler: SetupGuideSaveHandler) => void;
} | null>(null);

export function SetupGuideSaveProvider({
  children,
  registerSave,
}: {
  children: ReactNode;
  registerSave: (handler: SetupGuideSaveHandler) => void;
}) {
  const value = useMemo(() => ({ registerSave }), [registerSave]);
  return <SetupGuideSaveContext.Provider value={value}>{children}</SetupGuideSaveContext.Provider>;
}

export function useRegisterStepSave(handler: SetupGuideSaveHandler) {
  const ctx = useContext(SetupGuideSaveContext);
  useEffect(() => {
    ctx?.registerSave(handler);
    return () => ctx?.registerSave(null);
  }, [ctx, handler]);
}

export function useSetupGuideSaveBridge() {
  const handlerRef = useRef<SetupGuideSaveHandler>(null);
  const [hasSave, setHasSave] = useState(false);

  const registerSave = useCallback((handler: SetupGuideSaveHandler) => {
    handlerRef.current = handler;
    setHasSave(Boolean(handler));
  }, []);

  const runSave = useCallback(async () => {
    if (!handlerRef.current) return true;
    return handlerRef.current();
  }, []);

  return { registerSave, runSave, hasSave };
}
