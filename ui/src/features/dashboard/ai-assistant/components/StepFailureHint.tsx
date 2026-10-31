import { useState } from 'react';

import { HelpCircle } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const DEFAULT_REASON = "This check couldn't run, so it was skipped.";

/**
 * "?" beside a failed assistant step. Hover or focus opens it on desktop; tap toggles it on touch
 * (stock Radix tooltips close on tap, so the trigger handles clicks itself).
 */
export function StepFailureHint({ reason, className }: { reason?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const text = reason?.trim() || DEFAULT_REASON;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Why this step failed"
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              setOpen((value) => !value);
            }}
            className={cn(
              'text-muted-foreground hover:text-foreground relative inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors',
              'after:absolute after:-inset-3 after:content-[""]',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
              className
            )}
          >
            <HelpCircle className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="max-w-[min(calc(100vw-2rem),16rem)] px-3 py-2 text-xs leading-relaxed"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
