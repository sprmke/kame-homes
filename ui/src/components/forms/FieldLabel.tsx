import { useCallback, useRef, useState, type ReactNode } from 'react';

import { HelpCircle } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden>
      {' '}
      *
    </span>
  );
}

type FieldLabelProps = {
  htmlFor?: string;
  label: string;
  required?: boolean;
  /** Optional help copy shown in a tooltip on the ? next to the label. */
  help?: string;
  className?: string;
};

type HelpTooltipSide = 'right' | 'left' | 'top';

const VIEWPORT_PAD_PX = 16;
const SIDE_OFFSET_PX = 8;
const TOOLTIP_MAX_WIDTH_PX = 288;

function pickHelpTooltipSide(trigger: DOMRect): HelpTooltipSide {
  const viewportWidth = window.innerWidth;
  const isRtl = document.documentElement.dir === 'rtl';
  const needed = Math.min(TOOLTIP_MAX_WIDTH_PX, viewportWidth - VIEWPORT_PAD_PX * 2);
  const inlineEnd = isRtl ? 'left' : 'right';
  const inlineStart = isRtl ? 'right' : 'left';
  const inlineEndSpace = isRtl
    ? trigger.left - VIEWPORT_PAD_PX - SIDE_OFFSET_PX
    : viewportWidth - trigger.right - VIEWPORT_PAD_PX - SIDE_OFFSET_PX;
  const inlineStartSpace = isRtl
    ? viewportWidth - trigger.right - VIEWPORT_PAD_PX - SIDE_OFFSET_PX
    : trigger.left - VIEWPORT_PAD_PX - SIDE_OFFSET_PX;
  const spaceTop = trigger.top - VIEWPORT_PAD_PX - SIDE_OFFSET_PX;

  if (inlineEndSpace >= needed) return inlineEnd;
  if (inlineStartSpace >= needed) return inlineStart;
  if (spaceTop >= 48) return 'top';
  return inlineEnd;
}

/** Shared ? help control used by FieldLabel and section titles. */
export function FieldHelpTooltip({ label, help }: { label: string; help: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [side, setSide] = useState<HelpTooltipSide>('right');

  const updateSide = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setSide(pickHelpTooltipSide(trigger.getBoundingClientRect()));
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip
        onOpenChange={(open) => {
          if (open) updateSide();
        }}
      >
        <TooltipTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            onPointerEnter={updateSide}
            onFocus={updateSide}
            className={cn(
              'text-muted-foreground hover:text-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
            )}
            aria-label={`About ${label}`}
          >
            <HelpCircle className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align="center"
          sideOffset={SIDE_OFFSET_PX}
          collisionPadding={VIEWPORT_PAD_PX}
          className="max-h-[min(12rem,calc(100vh-2rem))] max-w-[min(calc(100vw-2rem),18rem)] overflow-y-auto break-words px-3.5 py-2.5 text-left text-xs leading-relaxed"
        >
          {help}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FieldLabel({ htmlFor, label, required = false, help, className }: FieldLabelProps) {
  const helpText = help?.trim() ?? '';
  const labelEl: ReactNode = (
    <Label htmlFor={htmlFor} className={cn(helpText && 'mb-0', !helpText && className)}>
      {label}
      {required ? <RequiredMark /> : null}
    </Label>
  );

  if (!helpText) {
    return labelEl;
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {labelEl}
      <FieldHelpTooltip label={label} help={helpText} />
    </div>
  );
}
