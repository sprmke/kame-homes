import { RotateCcw, WifiOff } from 'lucide-react';

import { useAiAssistantSession } from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';

import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

/** Offline, stopped-mid-turn, error + Retry, and limit notices above the composer (both surfaces). */
export function AssistantStatusNotices({ className }: { className?: string }) {
  const online = useOnlineStatus();
  const { error, canRetry, retryFailedTurn, partialCancelEffects, upgradeHook } =
    useAiAssistantSession();

  return (
    <div className={cn('space-y-1.5 empty:hidden', className)}>
      {!online ? (
        <div
          role="status"
          className="bg-muted text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
        >
          <WifiOff className="size-3.5 shrink-0" aria-hidden />
          You&apos;re offline
        </div>
      ) : null}

      {partialCancelEffects && partialCancelEffects.length > 0 ? (
        <div
          className="bg-warning/10 text-warning-foreground rounded-lg px-3 py-2 text-xs"
          role="status"
        >
          <p className="font-medium">Stopped. These changes were already applied:</p>
          <ul className="mt-1 list-inside list-disc">
            {partialCancelEffects.map((effect) => (
              <li key={effect.toolName}>{effect.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 flex items-center gap-2 rounded-lg border px-3 py-1.5"
        >
          <p className="text-destructive line-clamp-2 min-w-0 flex-1 text-xs" title={error}>
            {error}
          </p>
          {canRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[36px] shrink-0 gap-1.5 px-2 text-xs"
              onClick={() => void retryFailedTurn()}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {upgradeHook ? (
        <p className="text-warning text-xs" role="status">
          You&apos;ve hit today&apos;s message limit for the assistant.
        </p>
      ) : null}
    </div>
  );
}
