import * as React from 'react';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type BottomSheetContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof SheetContent>,
  'side' | 'showHandle'
> & {
  /** Extra class on the scrollable body wrapper (`layout="scroll"` only). */
  bodyClassName?: string;
  /**
   * `scroll` — single padded scroll region (simple sheets).
   * `split` — no body wrapper; caller owns sticky header / scroll / footer.
   *          Pass a definite height via `className` (e.g. `h-[92dvh]`) on tall sheets
   *          so the inner `flex-1 min-h-0 overflow-y-auto` region scrolls and the
   *          footer stays pinned — or pass `maxHeightPx` instead to have
   *          `BottomSheetContent` measure content and shrink-fit up to that cap (see
   *          `maxHeightPx`). Do not use `h-[min(92dvh,max-content)]` — the
   *          `max-content` term makes the value content-based again, and mobile
   *          WebKit then scrolls the whole sheet instead of the inner region.
   */
  layout?: 'scroll' | 'split';
  /**
   * `layout="split"` only, opt-in: measures content with `ResizeObserver` and sets
   * an explicit `height: min(measured, maxHeightPx, 92dvh)`, so the sheet shrinks to
   * fit short content instead of always opening at a fixed height with dead space
   * (e.g. AdminMoreSheet). Pure CSS can't do this on iOS Safari — a flex column only
   * bounds a nested `overflow-y:auto` child once the column itself has a *definite*
   * height (not `max-height`), and a definite height by nature doesn't shrink-wrap.
   * Omit this (default) to keep passing a fixed height via `className` as before.
   */
  maxHeightPx?: number;
};

/**
 * Bottom sheet defaulting `side="bottom"` with drag-handle + safe-area padding.
 * Built on the shared Sheet (Radix dialog) — no second gesture library.
 */
const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetContent>,
  BottomSheetContentProps
>(
  (
    {
      className,
      children,
      bodyClassName,
      layout = 'scroll',
      maxHeightPx,
      hideClose = true,
      style,
      ...props
    },
    forwardedRef
  ) => {
    const fitContent = layout === 'split' && maxHeightPx != null;
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const splitRef = React.useRef<HTMLDivElement | null>(null);
    const [measuredHeight, setMeasuredHeight] = React.useState<number | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef]
    );

    React.useLayoutEffect(() => {
      if (!fitContent) return undefined;
      const splitEl = splitRef.current;
      if (!splitEl) return undefined;

      const measure = () => {
        // Handle row (siblings before the split wrapper) + the split wrapper's own
        // natural content height, so `height` covers handle + nav + footer exactly.
        const handleHeight =
          splitEl.previousElementSibling instanceof HTMLElement
            ? splitEl.previousElementSibling.offsetHeight
            : 0;
        setMeasuredHeight(handleHeight + splitEl.scrollHeight);
      };

      // Synchronous first measurement (before paint) avoids a flash at the fallback
      // max height; ResizeObserver keeps it correct as content changes afterward.
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(splitEl);
      return () => observer.disconnect();
    }, [fitContent]);

    const fitContentStyle: React.CSSProperties = fitContent
      ? {
          height:
            measuredHeight != null
              ? `min(${measuredHeight}px, ${maxHeightPx}px, 92dvh)`
              : `min(${maxHeightPx}px, 92dvh)`,
        }
      : {};

    return (
      <SheetContent
        ref={setRefs}
        side="bottom"
        hideClose={hideClose}
        showHandle
        style={{ ...fitContentStyle, ...style }}
        className={cn(
          'flex min-h-0 w-full max-w-none flex-col overflow-hidden',
          /* Cap only — callers that need a scrollport (Admin More) pass explicit `h-[…dvh]`. */
          'max-h-[92dvh]',
          className,
          /* Always edge-to-edge — callers often pass Dialog-oriented max-w tokens. */
          '!inset-x-0 !w-full !max-w-none'
        )}
        {...props}
      >
        {layout === 'split' ? (
          /* Fills the definite height set above so flex-1 + min-h-0 children get a real scrollport. */
          <div ref={splitRef} className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {children}
          </div>
        ) : (
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 [-webkit-overflow-scrolling:touch]',
              bodyClassName
            )}
          >
            {children}
          </div>
        )}
      </SheetContent>
    );
  }
);
BottomSheetContent.displayName = 'BottomSheetContent';

export {
  Sheet as BottomSheet,
  SheetTrigger as BottomSheetTrigger,
  SheetClose as BottomSheetClose,
  BottomSheetContent,
  SheetHeader as BottomSheetHeader,
  SheetFooter as BottomSheetFooter,
  SheetTitle as BottomSheetTitle,
  SheetDescription as BottomSheetDescription,
};
