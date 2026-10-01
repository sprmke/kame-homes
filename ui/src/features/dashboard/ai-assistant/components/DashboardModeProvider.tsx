import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useSearchParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAiAssistantAccess } from '@/features/dashboard/ai-assistant/hooks/useAiAssistantAccess';
import {
  fetchUserUiPreferences,
  updateUserUiPreferences,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import {
  CANVAS_CLOSED_VALUE,
  CANVAS_SEARCH_PARAM,
  MODE_SEARCH_PARAM,
} from '@/features/dashboard/ai-assistant/lib/assistantScope';
import {
  isDashboardMode,
  readCachedDashboardMode,
  resolveDashboardModeAvailability,
  resolveEffectiveDashboardMode,
  writeCachedDashboardMode,
  type DashboardMode,
} from '@/features/dashboard/ai-assistant/lib/dashboardMode';
import {
  DashboardModeContext,
  type DashboardModeContextValue,
} from '@/features/dashboard/ai-assistant/lib/dashboardModeContext';
import { runModeViewTransition } from '@/features/dashboard/ai-assistant/lib/modeTransition';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

const preferencesKey = (userId: string | null) => ['user-ui-preferences', userId] as const;

type Props = {
  children: ReactNode;
  userId: string | null;
  superAdmin: boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Owns the Advanced / AI dashboard mode for one admin shell. Server row is the source of truth,
 * localStorage paints instantly, `?mode=` overrides once. Docs: ai-chat-mode.md (Phase 2).
 */
export function DashboardModeProvider({ children, userId, superAdmin }: Props) {
  const queryClient = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();
  const { open: openUpgradeModal } = useUpgradeModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [saved, setSaved] = useState<DashboardMode>(
    () => readCachedDashboardMode(userId) ?? 'advanced'
  );
  const [transitioning, setTransitioning] = useState(false);
  /** Once the host picks a mode this session, a slower GET must never overwrite it. */
  const localChoiceRef = useRef(false);

  const propertyId = usePropertyIdParam();
  // Same cached query the launcher uses; no extra request.
  const access = useAiAssistantAccess(superAdmin ? null : propertyId);
  const settings = access.settings;
  const assistantVisible = Boolean(
    settings &&
    settings.platformEnabled &&
    settings.enabled &&
    access.permissionAllowed &&
    !(propertyId && settings.disabledPropertyIds.includes(propertyId))
  );
  const availability = resolveDashboardModeAvailability({
    superAdmin,
    loading: access.isLoading || access.planGate.isLoading || access.permissionLoading,
    assistantVisible,
    aiModeEnabled: Boolean(settings?.aiModeEnabled),
    planAllowed: access.planGate.allowed,
  });

  const preferences = useQuery({
    queryKey: preferencesKey(userId),
    queryFn: fetchUserUiPreferences,
    enabled: Boolean(userId) && availability !== 'hidden',
    staleTime: 5 * 60_000,
    retry: false,
  });
  const persist = useMutation({
    mutationFn: updateUserUiPreferences,
    onSuccess: (data) => queryClient.setQueryData(preferencesKey(userId), data),
  });

  useEffect(() => {
    setSaved(readCachedDashboardMode(userId) ?? 'advanced');
    localChoiceRef.current = false;
  }, [userId]);

  useEffect(() => {
    const serverMode = preferences.data?.dashboardMode;
    if (!serverMode || localChoiceRef.current) return;
    setSaved(serverMode);
    writeCachedDashboardMode(userId, serverMode);
  }, [preferences.data?.dashboardMode, userId]);

  const commit = useCallback(
    (next: DashboardMode) => {
      localChoiceRef.current = true;
      writeCachedDashboardMode(userId, next);
      persist.mutate({ dashboardMode: next });
      const apply = () => {
        setSaved(next);
        // Chat-first (full width): split view is opt-in via Split View or page nav.
        if (next === 'ai') {
          setSearchParams(
            (prev) => {
              const params = new URLSearchParams(prev);
              params.set(CANVAS_SEARCH_PARAM, CANVAS_CLOSED_VALUE);
              return params;
            },
            { replace: true }
          );
        }
      };
      const usedViewTransition = runModeViewTransition(apply, { reducedMotion });
      if (!usedViewTransition) {
        setTransitioning(!reducedMotion);
        apply();
      }
    },
    [persist, reducedMotion, setSearchParams, userId]
  );

  const mode = resolveEffectiveDashboardMode(saved, availability);

  const setMode = useCallback(
    (next: DashboardMode) => {
      if (next === 'ai' && availability === 'locked') {
        openUpgradeModal('aiDashboardAssistant');
        return;
      }
      if (next === 'ai' && availability !== 'available') return;
      if (next === mode) return;
      commit(next);
    },
    [availability, commit, mode, openUpgradeModal]
  );

  const toggleMode = useCallback(() => {
    setMode(mode === 'ai' ? 'advanced' : 'ai');
  }, [mode, setMode]);

  // `?mode=ai|advanced` — one-shot override (shared links, E2E). Persisted, then stripped.
  const modeParam = searchParams.get(MODE_SEARCH_PARAM);
  useEffect(() => {
    if (!modeParam) return;
    if (isDashboardMode(modeParam)) {
      localChoiceRef.current = true;
      setSaved(modeParam);
      writeCachedDashboardMode(userId, modeParam);
      if (userId) persist.mutate({ dashboardMode: modeParam });
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(MODE_SEARCH_PARAM);
        if (modeParam === 'ai') {
          next.set(CANVAS_SEARCH_PARAM, CANVAS_CLOSED_VALUE);
        }
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per param value
  }, [modeParam]);

  // Cmd/Ctrl+J toggles the mode (skipped while typing in a field other than the composer).
  useEffect(() => {
    if (availability === 'hidden' || availability === 'pending') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key.toLowerCase() !== 'j') return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (
        isTypingTarget(target) &&
        !(target instanceof HTMLElement && target.dataset.assistantComposer === 'true')
      ) {
        return;
      }
      event.preventDefault();
      toggleMode();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [availability, toggleMode]);

  const onTransitionEnd = useCallback(() => setTransitioning(false), []);

  const value = useMemo<DashboardModeContextValue>(
    () => ({ mode, availability, transitioning, setMode, toggleMode, onTransitionEnd }),
    [mode, availability, transitioning, setMode, toggleMode, onTransitionEnd]
  );

  return <DashboardModeContext.Provider value={value}>{children}</DashboardModeContext.Provider>;
}
