import { createContext, useContext } from 'react';

import type {
  DashboardMode,
  DashboardModeAvailability,
} from '@/features/dashboard/ai-assistant/lib/dashboardMode';

export type DashboardModeContextValue = {
  /** What the layout renders (saved mode after gating). */
  mode: DashboardMode;
  availability: DashboardModeAvailability;
  /** True while the framer fallback animation runs (View Transitions handle their own). */
  transitioning: boolean;
  /** Switch mode with the shared transition. Locked availability opens the upgrade modal. */
  setMode: (mode: DashboardMode) => void;
  toggleMode: () => void;
  onTransitionEnd: () => void;
};

const fallback: DashboardModeContextValue = {
  mode: 'advanced',
  availability: 'hidden',
  transitioning: false,
  setMode: () => {},
  toggleMode: () => {},
  onTransitionEnd: () => {},
};

export const DashboardModeContext = createContext<DashboardModeContextValue>(fallback);

/** Advanced mode outside the provider (super-admin shell, tests). */
export function useDashboardMode(): DashboardModeContextValue {
  return useContext(DashboardModeContext);
}
