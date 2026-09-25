import * as React from 'react';

import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { useDragControls, motion, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 modal-scrim fixed inset-0 z-50 data-[state=closed]:pointer-events-none',
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'bg-card data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
  {
    variants: {
      side: {
        top: 'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 border-b p-6',
        bottom:
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 flex max-h-[min(92dvh,100%)] min-h-0 w-full max-w-none flex-col overflow-hidden rounded-t-2xl border-t p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        left: 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r p-6 sm:max-w-sm',
        right:
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l p-6 sm:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  }
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Hide the default close control (e.g. bottom sheets with a drag handle / explicit dismiss). */
  hideClose?: boolean;
  /** Show a top drag-handle affordance (bottom sheets). */
  showHandle?: boolean;
  /** Extra classes on the frosted scrim (e.g. darker for media lightboxes). */
  overlayClassName?: string;
  /** Disable drag-to-dismiss on a `side="bottom"` sheet (default enabled). */
  disableDrag?: boolean;
}

/** Downward drag distance (px) past which a release dismisses the sheet. */
const DRAG_CLOSE_DISTANCE = 120;
/** Downward flick velocity (px/s) past which a release dismisses regardless of distance. */
const DRAG_CLOSE_VELOCITY = 700;

type DraggableSheetBodyProps = {
  children: React.ReactNode;
  /** Handle affordance rendered above `children`, inside the drag surface. */
  handle: React.ReactNode;
};

/**
 * Wraps bottom-sheet content so the sheet tracks a vertical drag that starts
 * on the handle — hold and slide down to dismiss, release early to snap
 * back. The drag listener lives only on the handle row, not the scrollable
 * body, so swiping inside form/list content keeps scrolling instead of
 * dragging the sheet. Closing goes through Radix's own Close control (a
 * synthetic click) so onOpenChange, focus return, and escape/overlay-click
 * behavior all stay unified.
 */
function DraggableSheetBody({ children, handle }: DraggableSheetBodyProps) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const dragControls = useDragControls();
  const reduceMotion = usePrefersReducedMotion();

  const handleDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const shouldClose =
      info.offset.y > DRAG_CLOSE_DISTANCE || info.velocity.y > DRAG_CLOSE_VELOCITY;

    if (shouldClose) closeRef.current?.click();
    // Otherwise let framer-motion's own drag constraint spring the element back to
    // y:0 — do not also drive `y` via a separate `animate` prop/controls. Mixing an
    // externally-created motion value with a declarative `animate` on the same
    // transform is a known framer-motion footgun: drag's internal tracking and
    // `controls.start` can desync, leaving the element visually offset after a drag
    // that didn't cross the close threshold.
  };

  const closeButton = (
    <SheetPrimitive.Close ref={closeRef} className="hidden" aria-hidden tabIndex={-1} />
  );

  if (reduceMotion) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {closeButton}
        {handle}
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={handleDragEnd}
    >
      {closeButton}
      <div
        onPointerDown={(event) => dragControls.start(event)}
        className="shrink-0 touch-none [cursor:grab] active:[cursor:grabbing]"
      >
        {handle}
      </div>
      {children}
    </motion.div>
  );
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side = 'right',
      className,
      children,
      hideClose = false,
      showHandle = false,
      overlayClassName,
      disableDrag = false,
      ...props
    },
    ref
  ) => {
    const isDraggableBottomSheet = side === 'bottom' && !disableDrag;
    const handle =
      showHandle || side === 'bottom' ? (
        <div className="flex justify-center pb-1 pt-3" aria-hidden>
          <div className="bg-muted-foreground/35 h-1 w-10 rounded-full" />
        </div>
      ) : null;

    return (
      <SheetPortal>
        <SheetOverlay className={overlayClassName} />
        <SheetPrimitive.Content
          ref={ref}
          className={cn(sheetVariants({ side }), className)}
          {...props}
        >
          {!hideClose && side !== 'bottom' ? (
            <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          ) : null}
          {isDraggableBottomSheet ? (
            <DraggableSheetBody handle={handle}>{children}</DraggableSheetBody>
          ) : (
            <>
              {handle}
              {children}
            </>
          )}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  }
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-foreground text-base font-semibold', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
