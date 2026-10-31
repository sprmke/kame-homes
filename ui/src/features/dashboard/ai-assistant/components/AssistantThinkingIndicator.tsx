import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Incoming-message thinking bubble — same slot as the assistant reply. */
export function AssistantThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        role="status"
        aria-live="polite"
        aria-label="Assistant is thinking"
        className={cn(
          'border-border/60 bg-card inline-flex items-center gap-2.5 rounded-2xl rounded-bl-md border px-3 py-2 shadow-sm',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200'
        )}
      >
        <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
          <Sparkles className="size-3.5 motion-safe:animate-pulse" aria-hidden />
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          <span className="bg-primary motion-safe:animate-think-dot size-1.5 rounded-full" />
          <span className="bg-primary motion-safe:animate-think-dot animation-delay-150 size-1.5 rounded-full" />
          <span className="bg-primary motion-safe:animate-think-dot animation-delay-300 size-1.5 rounded-full" />
        </span>
      </div>
    </div>
  );
}
