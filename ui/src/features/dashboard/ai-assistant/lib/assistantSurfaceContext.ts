import { createContext, useCallback, useContext } from 'react';

import { useNavigate } from 'react-router-dom';

import { useOptionalAiAssistantSession } from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';
import { hrefWithChat } from '@/features/dashboard/ai-assistant/lib/assistantScope';

/**
 * Which container renders the shared chat core. Behavior is identical on both; this only drives
 * layout density and what "open a page" means:
 * - sheet (Advanced mode): navigate, then close the sheet so the page is visible
 * - full (AI mode): navigate inside the canvas and keep the conversation in `?chat=`
 */
export type AssistantSurface = 'sheet' | 'full';

export type AssistantSurfaceContextValue = {
  surface: AssistantSurface;
  /** Called after an in-app navigation started from the chat. */
  afterNavigate?: () => void;
};

export const AssistantSurfaceContext = createContext<AssistantSurfaceContextValue>({
  surface: 'sheet',
});

export function useAssistantSurface(): AssistantSurfaceContextValue {
  return useContext(AssistantSurfaceContext);
}

/** Resolves an in-app href for the current surface (keeps `?chat=` on the full page). */
export function useAssistantHref(): (href: string) => string {
  const { surface } = useAssistantSurface();
  const conversationId = useOptionalAiAssistantSession()?.conversationId ?? null;
  return useCallback(
    (href: string) => (surface === 'full' ? hrefWithChat(href, conversationId) : href),
    [surface, conversationId]
  );
}

/** Navigate from a chat block: resolves the href for the surface, then runs `afterNavigate`. */
export function useAssistantNavigate(): (href: string) => void {
  const navigate = useNavigate();
  const resolve = useAssistantHref();
  const { afterNavigate } = useAssistantSurface();
  return useCallback(
    (href: string) => {
      if (!href.startsWith('/')) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      navigate(resolve(href));
      afterNavigate?.();
    },
    [navigate, resolve, afterNavigate]
  );
}
