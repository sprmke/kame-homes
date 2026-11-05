import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { HelpCircle, Info } from 'lucide-react';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useIsHoverFine } from '@/hooks/useMediaQuery';
import type { HelpHintVariant } from '@/lib/help/types';
import { cn } from '@/lib/utils';

type HelpHintSide = 'top' | 'right' | 'bottom' | 'left';
type HelpHintAlign = 'start' | 'center' | 'end';

export type InfoHintProps = {
  /** Accessible name, e.g. "Minimum nightly price". Rendered as `About <label>`. */
  label: string;
  /** Hint copy. One or two sentences. */
  text?: ReactNode;
  /** Alternative to `text` for richer content. */
  children?: ReactNode;
  /** `?` for fields, `i` for metrics and section titles. */
  variant?: HelpHintVariant;
  side?: HelpHintSide;
  align?: HelpHintAlign;
  className?: string;
  /**
   * Renders the same copy in a visually hidden span with this id, so a field
   * can set `aria-describedby` and screen readers read the hint on focus.
   */
  describedById?: string;
};

const VIEWPORT_PAD_PX = 16;
const SIDE_OFFSET_PX = 8;
const CONTENT_MAX_WIDTH_PX = 288;
const HOVER_OPEN_DELAY_MS = 120;
const HOVER_CLOSE_DELAY_MS = 120;

function viewportAllowsWidth(trigger: DOMRect, side: 'left' | 'right'): boolean {
  const needed = Math.min(CONTENT_MAX_WIDTH_PX, window.innerWidth - VIEWPORT_PAD_PX * 2);
  const isRtl = document.documentElement.dir === 'rtl';
  const inlineEnd = isRtl ? 'left' : 'right';
  const inlineStart = isRtl ? 'right' : 'left';
  const endSpace =
    inlineEnd === 'right'
      ? window.innerWidth - trigger.right - VIEWPORT_PAD_PX - SIDE_OFFSET_PX
      : trigger.left - VIEWPORT_PAD_PX - SIDE_OFFSET_PX;
  const startSpace =
    inlineStart === 'right'
      ? window.innerWidth - trigger.right - VIEWPORT_PAD_PX - SIDE_OFFSET_PX
      : trigger.left - VIEWPORT_PAD_PX - SIDE_OFFSET_PX;

  return (side === inlineEnd ? endSpace : startSpace) >= needed;
}

/** Prefer the inline end, fall back to the inline start, then above. RTL aware. */
function pickSide(trigger: DOMRect, preferred: HelpHintSide): HelpHintSide {
  if (preferred === 'top' || preferred === 'bottom') return preferred;

  const isRtl = document.documentElement.dir === 'rtl';
  const inlineEnd: HelpHintSide = isRtl ? 'left' : 'right';
  const inlineStart: HelpHintSide = isRtl ? 'right' : 'left';

  if (viewportAllowsWidth(trigger, preferred)) return preferred;
  if (viewportAllowsWidth(trigger, inlineEnd)) return inlineEnd;
  if (viewportAllowsWidth(trigger, inlineStart)) return inlineStart;
  if (trigger.top >= 48) return 'top';
  return inlineEnd;
}

/**
 * The one touch-safe help control for the host dashboard.
 *
 * Mouse and trackpad hover opens it; click / tap opens and pins it; Enter or
 * Space toggles it; Esc or an outside tap closes it. It is a real `<button>`
 * outside any parent label, and stops the events that would submit a form,
 * toggle a label, navigate a card link, or start a bottom-sheet drag.
 *
 * Inside a modal the content portals into the active dialog, so a modal's
 * inert background and pointer-events lock do not swallow the hint.
 */
export function InfoHint({
  label,
  text,
  children,
  variant = 'field',
  side = 'right',
  align = 'center',
  className,
  describedById,
}: InfoHintProps) {
  const content = text ?? children;
  const contentId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const pinnedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [resolvedSide, setResolvedSide] = useState<HelpHintSide>(side);
  const finePointer = useIsHoverFine();

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const show = useCallback(
    (pin: boolean) => {
      clearTimer();
      const trigger = triggerRef.current;
      if (!trigger) return;

      const dialog = trigger.closest('[role="dialog"]');
      setContainer(dialog instanceof HTMLElement ? dialog : null);
      setResolvedSide(pickSide(trigger.getBoundingClientRect(), side));
      pinnedRef.current = pin;
      setOpen(true);
    },
    [clearTimer, side]
  );

  const hide = useCallback(() => {
    clearTimer();
    pinnedRef.current = false;
    setOpen(false);
  }, [clearTimer]);

  const scheduleOpen = useCallback(() => {
    if (!finePointer || open) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => show(false), HOVER_OPEN_DELAY_MS);
  }, [clearTimer, finePointer, open, show]);

  const scheduleClose = useCallback(() => {
    if (!finePointer || pinnedRef.current) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (!pinnedRef.current) setOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearTimer, finePointer]);

  const handleClick = () => {
    if (!open) {
      show(true);
      return;
    }
    if (!pinnedRef.current) {
      // Hover-opened: the first click pins it instead of yanking it away.
      pinnedRef.current = true;
      return;
    }
    hide();
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    // Do not let a click inside a bottom sheet start a drag session.
    event.stopPropagation();
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    // Keyboard focus only. Mouse/trackpad focus is handled by hover.
    if (!finePointer) return;
    if (event.currentTarget.matches(':focus-visible')) show(false);
  };

  const handleBlur = () => {
    if (!finePointer || pinnedRef.current) return;
    scheduleClose();
  };

  const Glyph = variant === 'field' ? HelpCircle : Info;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!next) hide();
        }}
      >
        <PopoverAnchor asChild>
          <button
            ref={triggerRef}
            type="button"
            aria-label={`About ${label}`}
            aria-expanded={open}
            aria-controls={open ? contentId : undefined}
            aria-describedby={describedById}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerEnter={scheduleOpen}
            onPointerLeave={scheduleClose}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              'text-muted-foreground/70 hover:text-foreground relative -my-1 inline-flex size-6 shrink-0 touch-manipulation items-center justify-center rounded-full align-middle transition-colors',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              "before:absolute before:-inset-2.5 before:content-['']",
              className
            )}
          >
            <Glyph className="size-3.5" aria-hidden />
          </button>
        </PopoverAnchor>
        <PopoverContent
          id={contentId}
          role="tooltip"
          side={resolvedSide}
          align={align}
          sideOffset={SIDE_OFFSET_PX}
          collisionPadding={VIEWPORT_PAD_PX}
          collisionBoundary={container ?? undefined}
          avoidCollisions
          container={container}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerEnter={clearTimer}
          onPointerLeave={scheduleClose}
          className="max-h-[min(12rem,calc(100vh-2rem))] w-auto max-w-[min(calc(100vw-2rem),18rem)] overflow-y-auto break-words px-3.5 py-2.5 text-left text-xs leading-relaxed"
        >
          {content}
        </PopoverContent>
      </Popover>
      {describedById ? (
        <span id={describedById} className="sr-only">
          {content}
        </span>
      ) : null}
    </>
  );
}
