import * as React from 'react';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  size?: 'default' | 'wide' | 'full' | 'sidebar';
  bodyClassName?: string;
  /**
   * When a nested AlertDialog (or similar) is open above this modal, keep the
   * parent from dismissing on the nested overlay's pointer/escape events.
   */
  nestedOverlayOpen?: boolean;
};

const sizeClass: Record<NonNullable<Props['size']>, string> = {
  default: 'sm:max-w-[min(90vw,28rem)]',
  wide: 'sm:max-w-[min(95vw,42rem)] max-h-[min(92dvh,720px)]',
  full: 'sm:max-w-[min(95vw,48rem)] max-h-[min(92dvh,780px)]',
  sidebar: 'sm:max-w-[min(96vw,56rem)] lg:max-w-[min(92vw,60rem)] max-h-[min(92dvh,820px)]',
};

/** Radix may fire outside-dismiss after the nested alert unmounts; check the original click target. */
function isFromNestedAlertDialog(event: {
  detail?: { originalEvent?: Event };
  target?: EventTarget | null;
}) {
  const targets = [event.target, event.detail?.originalEvent?.target ?? null];
  return targets.some(
    (node) => node instanceof Element && Boolean(node.closest('[role="alertdialog"]'))
  );
}

export function TelegramManageDialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  headerAction,
  size = 'wide',
  bodyClassName,
  nestedOverlayOpen = false,
}: Props) {
  const blockDismiss = (event: {
    preventDefault: () => void;
    detail?: { originalEvent?: Event };
    target?: EventTarget | null;
  }) => {
    if (nestedOverlayOpen || isFromNestedAlertDialog(event)) {
      event.preventDefault();
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next && nestedOverlayOpen) return;
        onOpenChange(next);
      }}
    >
      <ResponsiveModalContent
        sheetLayout="split"
        className={cn(sizeClass[size], 'flex flex-col gap-0 overflow-hidden p-0 sm:p-0')}
        onPointerDownOutside={blockDismiss}
        onInteractOutside={blockDismiss}
        onFocusOutside={blockDismiss}
        onEscapeKeyDown={(event) => {
          if (nestedOverlayOpen) event.preventDefault();
        }}
      >
        <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <ResponsiveModalTitle className="text-base sm:text-lg">{title}</ResponsiveModalTitle>
            {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
          </div>
        </ResponsiveModalHeader>
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5',
            size === 'sidebar' && 'flex flex-col',
            bodyClassName
          )}
        >
          {children}
        </div>
        {footer ? (
          <ResponsiveModalFooter className="border-border/60 shrink-0 border-t px-4 py-3 sm:px-5">
            {footer}
          </ResponsiveModalFooter>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
