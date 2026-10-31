import * as React from 'react';

import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

import { sheetHeightForDrag, shouldDismissSheetDrag } from './sheetDrag';

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

type DragSession = {
  pointerId: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  velocityY: number;
};

type SheetHeightDrag = {
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  closeRef: React.MutableRefObject<HTMLButtonElement | null>;
  dragStyle: React.CSSProperties | undefined;
  onHandlePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onHandlePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onHandlePointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onHandlePointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
};

/**
 * Pointer drag writes the sheet container's used height. The sheet is
 * bottom-anchored, so a shorter height moves its top edge with the finger.
 * A translate on an inner node leaves this container (and its background)
 * at the resting height, which is the empty gap above the handle.
 * Height is applied directly per move, not transitioned, so layout tracks
 * the pointer instead of lagging a CSS height animation.
 */
function useSheetHeightDrag(enabled: boolean): SheetHeightDrag {
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const sessionRef = React.useRef<DragSession | null>(null);
  const [dragHeight, setDragHeight] = React.useState<number | null>(null);

  const onHandlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || event.button !== 0) return;
    const el = contentRef.current;
    if (!el) return;
    const startHeight = el.offsetHeight;
    sessionRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocityY: 0,
    };
    setDragHeight(startHeight);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    const now = performance.now();
    const dt = now - session.lastTime;
    if (dt > 0) {
      session.velocityY = ((event.clientY - session.lastY) / dt) * 1000;
    }
    session.lastY = event.clientY;
    session.lastTime = now;
    setDragHeight(sheetHeightForDrag(session.startHeight, event.clientY - session.startY));
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    sessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const deltaY = event.clientY - session.startY;
    if (shouldDismissSheetDrag(deltaY, session.velocityY)) {
      closeRef.current?.click();
      return;
    }
    setDragHeight(null);
  };

  const dragStyle: React.CSSProperties | undefined =
    dragHeight != null
      ? {
          height: dragHeight,
          minHeight: 0,
        }
      : undefined;

  return {
    contentRef,
    closeRef,
    dragStyle,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp: finishDrag,
    onHandlePointerCancel: finishDrag,
  };
}

type DraggableSheetBodyProps = {
  children: React.ReactNode;
  /** Handle affordance rendered above `children`, inside the drag surface. */
  handle: React.ReactNode;
  drag: SheetHeightDrag;
};

/**
 * Handle-only pointer target. The listener stays off the scrollable body so
 * swiping a form or list keeps scrolling. Dismiss goes through Radix Close
 * so onOpenChange, focus return, and overlay/escape behavior stay unified.
 */
function DraggableSheetBody({ children, handle, drag }: DraggableSheetBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SheetPrimitive.Close ref={drag.closeRef} className="hidden" aria-hidden tabIndex={-1} />
      <div
        onPointerDown={drag.onHandlePointerDown}
        onPointerMove={drag.onHandlePointerMove}
        onPointerUp={drag.onHandlePointerUp}
        onPointerCancel={drag.onHandlePointerCancel}
        className="shrink-0 touch-none select-none [cursor:grab] active:[cursor:grabbing]"
      >
        {handle}
      </div>
      {children}
    </div>
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
      style,
      ...props
    },
    ref
  ) => {
    const isDraggableBottomSheet = side === 'bottom' && !disableDrag;
    const drag = useSheetHeightDrag(isDraggableBottomSheet);
    const setContentRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        drag.contentRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [drag.contentRef, ref]
    );
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
          ref={setContentRef}
          className={cn(sheetVariants({ side }), className)}
          {...props}
          style={{ ...style, ...drag.dragStyle }}
        >
          {!hideClose && side !== 'bottom' ? (
            <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          ) : null}
          {isDraggableBottomSheet ? (
            <DraggableSheetBody drag={drag} handle={handle}>
              {children}
            </DraggableSheetBody>
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
