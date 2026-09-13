import { createContext, useContext } from 'react';

import type { Organization } from '@/features/dashboard/org/types';
import type {
  SetupGuidePersistedState,
  SetupGuideProgressResult,
  SetupGuideStep,
} from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

export type SetupGuideContextValue = {
  org: Organization | null;
  steps: SetupGuideStep[];
  progress: SetupGuideProgressResult;
  persisted: SetupGuidePersistedState;
  open: boolean;
  activeStepId: string | null;
  openGuide: (stepId?: string | null) => void;
  closeGuide: (opts?: { dismiss?: boolean }) => void;
  goToStep: (stepId: string) => void;
  goNext: () => void;
  goBack: () => void;
  skipCurrent: () => void;
  requiredRemaining: number;
};

export const SetupGuideContext = createContext<SetupGuideContextValue | null>(null);

export function useSetupGuide(): SetupGuideContextValue {
  const ctx = useContext(SetupGuideContext);
  if (!ctx) {
    throw new Error('useSetupGuide must be used within SetupGuideProvider');
  }
  return ctx;
}

export function useOptionalSetupGuide(): SetupGuideContextValue | null {
  return useContext(SetupGuideContext);
}
