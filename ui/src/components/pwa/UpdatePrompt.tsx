import { useState } from 'react';

import { aboveBottomTabBarOverlayClassName } from '@/components/mobile/BottomTabBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UpdatePromptProps = {
  onReload: () => void;
};

/**
 * Shown when a new service worker is waiting. Non-blocking — the operator
 * finishes what they're doing and reloads when ready. Never auto-reloads.
 */
export function UpdatePrompt({ onReload }: UpdatePromptProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="status"
      className={cn(
        /* Above BottomTabBar (z-40); below Sheet/Dialog overlays (z-50 / z-100). */
        'fixed inset-x-0 z-[45] flex justify-center px-3',
        aboveBottomTabBarOverlayClassName()
      )}
    >
      <div className="border-border bg-background flex w-full max-w-sm items-center gap-3 rounded-xl border p-3 shadow-lg">
        <p className="text-foreground flex-1 text-sm font-medium">
          A new version is ready.
          <span className="text-muted-foreground block text-xs font-normal">
            Reload to get the latest changes.
          </span>
        </p>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Later
        </Button>
        <Button size="sm" onClick={onReload}>
          Reload
        </Button>
      </div>
    </div>
  );
}
