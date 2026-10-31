import * as React from 'react';

import {
  BottomSheet,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from '@/components/ui/bottom-sheet';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type ResponsiveModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

/**
 * Bottom sheet on phone/tablet (`max-lg`); centered Dialog on desktop (`lg+`).
 * Matches the admin native shell breakpoint so slide-ups stay edge-to-edge under `lg`.
 */
export function ResponsiveModal({ open, onOpenChange, children }: ResponsiveModalProps) {
  const useSheet = useIsBelowLg();

  if (useSheet) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        {children}
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

type ResponsiveModalContentProps = React.ComponentPropsWithoutRef<typeof DialogContent> & {
  /** Class applied only to the bottom-sheet body scroll region (`sheetLayout="scroll"`). */
  sheetBodyClassName?: string;
  /**
   * Sheet layout. Use `split` when the modal has sticky header/footer + an inner
   * `flex-1 overflow-y-auto` body (Get Verified, long forms). Default `scroll`
   * wraps all children in one scroll region.
   */
  sheetLayout?: 'scroll' | 'split';
};

export function ResponsiveModalContent({
  className,
  children,
  sheetBodyClassName,
  sheetLayout = 'scroll',
  showCloseButton,
  overlayClassName: _overlayClassName,
  ...props
}: ResponsiveModalContentProps) {
  const useSheet = useIsBelowLg();

  if (useSheet) {
    return (
      <BottomSheetContent
        hideClose
        layout={sheetLayout}
        overlayClassName={_overlayClassName}
        className={cn(
          'gap-0',
          sheetLayout === 'split' &&
            /* Height comes from BottomSheetContent split defaults; keep flex + clip. */
            'flex min-h-0 flex-col overflow-hidden !p-0',
          className,
          /* Dialog max-width / side padding must not inset phone/tablet sheets. */
          '!inset-x-0 !left-0 !right-0 !w-full !max-w-none'
        )}
        bodyClassName={cn(sheetLayout === 'scroll' && 'space-y-4', sheetBodyClassName)}
        {...props}
      >
        {children}
      </BottomSheetContent>
    );
  }

  return (
    <DialogContent
      className={cn(className)}
      showCloseButton={showCloseButton}
      overlayClassName={_overlayClassName}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function ResponsiveModalHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const useSheet = useIsBelowLg();
  if (useSheet) {
    return (
      <BottomSheetHeader
        className={cn('space-y-1 px-0 pb-1 pt-0 text-left', className)}
        {...props}
      />
    );
  }
  return <DialogHeader className={className} {...props} />;
}

export function ResponsiveModalFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const useSheet = useIsBelowLg();
  if (useSheet) {
    return (
      <BottomSheetFooter
        className={cn('flex-col-reverse gap-2 px-0 pt-2 sm:flex-row sm:justify-end', className)}
        {...props}
      />
    );
  }
  return <DialogFooter className={className} {...props} />;
}

export function ResponsiveModalTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogTitle>) {
  const useSheet = useIsBelowLg();
  if (useSheet) {
    // Match the desktop DialogTitle scale so a modal title reads identically in
    // sheet mode (phone/tablet) and dialog mode — BottomSheetTitle alone is only
    // `text-base font-semibold`.
    return (
      <BottomSheetTitle
        className={cn('text-base font-bold tracking-tight sm:text-lg', className)}
        {...props}
      />
    );
  }
  return <DialogTitle className={className} {...props} />;
}

export function ResponsiveModalDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogDescription>) {
  const useSheet = useIsBelowLg();
  if (useSheet) {
    return <BottomSheetDescription className={className} {...props} />;
  }
  return <DialogDescription className={className} {...props} />;
}

export function ResponsiveModalClose(props: React.ComponentPropsWithoutRef<typeof DialogClose>) {
  const useSheet = useIsBelowLg();
  if (useSheet) {
    return <BottomSheetClose {...props} />;
  }
  return <DialogClose {...props} />;
}

export function ResponsiveModalTrigger(
  props: React.ComponentPropsWithoutRef<typeof DialogTrigger>
) {
  const useSheet = useIsBelowLg();
  if (useSheet) {
    return <BottomSheetTrigger {...props} />;
  }
  return <DialogTrigger {...props} />;
}
