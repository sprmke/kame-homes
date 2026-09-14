import { lazy, Suspense, useState } from 'react';

import { Sparkles } from 'lucide-react';

import { useAiAssistantAccess } from '@/features/dashboard/ai-assistant/hooks/useAiAssistantAccess';
import { isAiAssistantFabVisible } from '@/features/dashboard/ai-assistant/lib/assistantFabLayout';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { cn } from '@/lib/utils';

// Chat composer/thread/canvas/history are a heavy subtree mounted in every dashboard
// page via AdminLayout — lazy-load and defer the fetch until the panel is first opened.
const AiAssistantPanel = lazy(() =>
  import('@/features/dashboard/ai-assistant/components/AiAssistantPanel').then((m) => ({
    default: m.AiAssistantPanel,
  }))
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When false, only the slide-over mounts (mobile tab is the trigger). */
  showFab?: boolean;
};

/** Mounted once in AdminLayout — visible only when both kill-switch layers are on for this org. */
export function AiAssistantLauncherButton({ open, onOpenChange, showFab = true }: Props) {
  const propertyId = usePropertyIdParam();
  const { accessible, settings, planGate } = useAiAssistantAccess(propertyId);
  // Defer the panel's import until the admin actually opens it at least once.
  const [hasOpenedOnce, setHasOpenedOnce] = useState(open);

  if (!isAiAssistantFabVisible(accessible, settings, planGate.allowed)) return null;

  // Blocked only by plan tier: keep past conversation history viewable, block new messages.
  const readOnly = !accessible;

  return (
    <>
      {showFab ? (
        <button
          type="button"
          onClick={() => {
            setHasOpenedOnce(true);
            onOpenChange(true);
          }}
          aria-label="Open AI assistant"
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'gradient-primary text-primary-foreground shadow-elevated-lg',
            'fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40',
            'hidden min-h-[52px] min-w-[52px] items-center justify-center rounded-full lg:flex',
            'transition-transform hover:scale-105',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'motion-reduce:transform-none motion-reduce:hover:scale-100'
          )}
        >
          <Sparkles className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
      {(hasOpenedOnce || open) && (
        <Suspense fallback={null}>
          <AiAssistantPanel
            open={open}
            onOpenChange={(next) => {
              if (next) setHasOpenedOnce(true);
              onOpenChange(next);
            }}
            readOnly={readOnly}
          />
        </Suspense>
      )}
    </>
  );
}
