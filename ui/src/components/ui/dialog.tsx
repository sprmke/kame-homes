import * as React from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Radix can leave `pointer-events: none` on body after nested dismiss layers (e.g. dropdown → dialog). */
function clearDialogBodyPointerEventsLock() {
  const clear = () => {
    document.body.style.removeProperty('pointer-events');
  };
  clear();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(clear);
  });
  window.setTimeout(clear, 300);
}

const Dialog = ({
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  React.useEffect(() => {
    if (open === false) {
      clearDialogBodyPointerEventsLock();
    }
  }, [open]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange?.(nextOpen);
        if (!nextOpen) {
          clearDialogBodyPointerEventsLock();
        }
      }}
      {...props}
    />
  );
};

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const lightbox =
    typeof className === 'string' && className.split(/\s+/).includes('modal-scrim-lightbox');

  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[100] data-[state=closed]:pointer-events-none',
        !lightbox && 'modal-scrim',
        className
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  overlayClassName?: string;
  /** When false, omit the default top-right close control (use an inline close in the header instead). */
  showCloseButton?: boolean;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    { className, overlayClassName, children, onCloseAutoFocus, showCloseButton = true, ...props },
    ref
  ) => (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          clearDialogBodyPointerEventsLock();
        }}
        className={cn(
          'border-border/50 bg-card shadow-elevated-lg fixed left-1/2 top-1/2 z-[101] grid max-h-[min(90dvh,640px)] w-full max-w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overflow-x-hidden rounded-xl border p-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)] pt-[max(env(safe-area-inset-top,0px),0.75rem)] outline-none duration-200',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'sm:max-w-[min(90vw,28rem)] sm:p-6',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            className="text-muted-foreground ring-offset-background hover:bg-muted focus:ring-ring absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl opacity-80 transition-all hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
            aria-label="Close"
          >
            <X className="size-5 shrink-0" aria-hidden />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2 pr-10 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-foreground text-base font-bold tracking-tight sm:text-lg', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm leading-relaxed', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
