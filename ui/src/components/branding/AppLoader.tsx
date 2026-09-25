import { createPortal } from 'react-dom';

import { platformMarkInitial, platformWordmarkParts } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

interface AppLoaderProps {
  /** Fills the viewport. Inline gates keep the same mark, still screen-centered. */
  fullScreen?: boolean;
}

/**
 * Root / global loader. Portaled to the body so parent transitions cannot
 * slide it, and pinned to the viewport so it stays centered.
 */
export function AppLoader({ fullScreen = false }: AppLoaderProps) {
  const wordmark = platformWordmarkParts();
  const initial = platformMarkInitial();

  const loader = (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        fullScreen && 'bg-background'
      )}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-3 opacity-70">
        <div
          className="bg-primary/90 flex size-10 items-center justify-center rounded-xl"
          aria-hidden
        >
          {initial ? (
            <span className="text-lg font-semibold text-white">{initial}</span>
          ) : (
            <span className="bg-primary-foreground/90 size-2 rounded-full" />
          )}
        </div>

        {wordmark ? (
          <p className="text-muted-foreground text-sm font-medium tracking-tight">
            {wordmark.primary}
            {wordmark.accent ? <span className="text-primary/80"> {wordmark.accent}</span> : null}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return loader;

  return createPortal(loader, document.body);
}
