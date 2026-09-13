import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useLocation, useParams } from 'react-router-dom';

import { isSuperAdminPath } from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import {
  SetupGuideContext,
  type SetupGuideContextValue,
} from '@/features/dashboard/setup-guide/components/setupGuideContext';
import { SetupGuideOverlay } from '@/features/dashboard/setup-guide/components/SetupGuideOverlay';
import { useSetupGuideProgressForOrgSlug } from '@/features/dashboard/setup-guide/hooks/useSetupGuideProgress';
import { useSetupGuideStateWrite } from '@/features/dashboard/setup-guide/hooks/useSetupGuideStateWrite';
import {
  clearSetupGuideRequiredRemaining,
  setSetupGuideRequiredRemaining,
} from '@/features/dashboard/setup-guide/lib/setupGuideIssuesStore';
import {
  isSetupGuideSessionSnoozed,
  setSetupGuideSessionSnoozed,
} from '@/features/dashboard/setup-guide/lib/setupGuideState';

export function SetupGuideProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const tenant = useOptionalOrgContext();
  const parkingTenant = useOptionalParkingContext();
  const { orgSlug: routeOrgSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = tenant?.orgSlug ?? parkingTenant?.orgSlug ?? routeOrgSlug;

  const [open, setOpen] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const didAutoOpenRef = useRef(false);
  const didStampCompleteRef = useRef(false);

  const { org, steps, progress, persisted } = useSetupGuideProgressForOrgSlug(orgSlug, {
    guideOpen: open,
    focusStepId: activeStepId,
  });
  const write = useSetupGuideStateWrite(org?.id);

  const requiredRemaining = progress.requiredRemaining;
  const superAdmin = isSuperAdminPath(location.pathname);

  useEffect(() => {
    if (!org?.id || superAdmin) {
      clearSetupGuideRequiredRemaining();
      return;
    }
    setSetupGuideRequiredRemaining(requiredRemaining);
  }, [org?.id, requiredRemaining, superAdmin]);

  useEffect(() => {
    if (!org?.id || superAdmin) return;
    if (requiredRemaining > 0) {
      didStampCompleteRef.current = false;
      return;
    }
    if (persisted.completedAt || didStampCompleteRef.current) return;
    didStampCompleteRef.current = true;
    void write.complete();
  }, [org?.id, persisted.completedAt, requiredRemaining, superAdmin, write]);

  useEffect(() => {
    if (didAutoOpenRef.current || superAdmin || !org) return;
    if (org.accessKind !== 'owner') return;
    if (persisted.completedAt || persisted.dismissedAt) return;
    if (isSetupGuideSessionSnoozed(org.id)) return;
    if (requiredRemaining === 0) return;

    const resumeId = persisted.lastStepId ?? progress.resumeStepId ?? steps[0]?.id ?? null;
    setActiveStepId(resumeId);
    setOpen(true);
    didAutoOpenRef.current = true;
  }, [
    org,
    persisted.completedAt,
    persisted.dismissedAt,
    persisted.lastStepId,
    progress.resumeStepId,
    requiredRemaining,
    steps,
    superAdmin,
  ]);

  const openGuide = useCallback(
    (stepId?: string | null) => {
      const resume =
        stepId ?? persisted.lastStepId ?? progress.resumeStepId ?? steps[0]?.id ?? null;
      setActiveStepId(resume);
      setOpen(true);
    },
    [persisted.lastStepId, progress.resumeStepId, steps]
  );

  const closeGuide = useCallback(
    (opts?: { dismiss?: boolean }) => {
      setOpen(false);
      if (org?.id) setSetupGuideSessionSnoozed(org.id, true);
      if (opts?.dismiss) void write.dismiss();
    },
    [org?.id, write]
  );

  const goToStep = useCallback(
    (stepId: string) => {
      setActiveStepId(stepId);
      write.setLastStepId(stepId);
    },
    [write]
  );

  const goNext = useCallback(() => {
    const ids = steps.map((step) => step.id);
    const idx = activeStepId ? ids.indexOf(activeStepId) : -1;
    const next = ids[Math.min(ids.length - 1, Math.max(0, idx + 1))];
    if (next) goToStep(next);
  }, [activeStepId, goToStep, steps]);

  const goBack = useCallback(() => {
    const ids = steps.map((step) => step.id);
    const idx = activeStepId ? ids.indexOf(activeStepId) : -1;
    const prev = ids[Math.max(0, idx - 1)];
    if (prev) goToStep(prev);
  }, [activeStepId, goToStep, steps]);

  const skipCurrent = useCallback(() => {
    if (!activeStepId) return;
    const skipped = new Set(persisted.skippedSteps);
    skipped.add(activeStepId);
    void write.setSkippedSteps([...skipped]);
    goNext();
  }, [activeStepId, goNext, persisted.skippedSteps, write]);

  const value = useMemo<SetupGuideContextValue>(
    () => ({
      org,
      steps,
      progress,
      persisted,
      open,
      activeStepId,
      openGuide,
      closeGuide,
      goToStep,
      goNext,
      goBack,
      skipCurrent,
      requiredRemaining,
    }),
    [
      org,
      steps,
      progress,
      persisted,
      open,
      activeStepId,
      openGuide,
      closeGuide,
      goToStep,
      goNext,
      goBack,
      skipCurrent,
      requiredRemaining,
    ]
  );

  return (
    <SetupGuideContext.Provider value={value}>
      {children}
      {!superAdmin && org ? <SetupGuideOverlay /> : null}
    </SetupGuideContext.Provider>
  );
}
