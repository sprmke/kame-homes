import type { ReactNode } from 'react';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

export type AdminDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plain title string, or custom header content that includes `ResponsiveModalTitle`. */
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Fixed action row (Save / Cancel / …). */
  footer: ReactNode;
  /** Optional trigger rendered inside `ResponsiveModal` (e.g. `ResponsiveModalTrigger`). */
  trigger?: ReactNode;
  /**
   * Desktop (`lg+`) width. Must include base + `sm:` max-width so we beat
   * DialogContent defaults. Ignored below `lg` (edge-to-edge sheet).
   */
  sizeClassName?: string;
  /** Height cap so the middle body can scroll. */
  heightClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  contentClassName?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
};

/**
 * Standard dashboard form modal: fixed title, scrollable body, fixed actions.
 * Bottom sheet (`sheetLayout="split"`) below `lg`; centered dialog on `lg+`.
 *
 * Use for general Save/Cancel (and similar) form dialogs. Do **not** wrap custom
 * wizards, approval reviews, lightboxes, or `AlertDialog` confirms — those keep
 * their own chrome.
 */
export function AdminDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  sizeClassName = 'max-w-[min(calc(100vw-1.5rem),28rem)] sm:max-w-[min(90vw,28rem)]',
  heightClassName = 'max-h-[min(90dvh,40rem)]',
  bodyClassName,
  headerClassName,
  footerClassName,
  contentClassName,
  overlayClassName,
  showCloseButton = true,
}: AdminDialogShellProps) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      {trigger}
      <ResponsiveModalContent
        sheetLayout="split"
        showCloseButton={showCloseButton}
        overlayClassName={overlayClassName}
        className={cn(
          'flex w-full flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:p-0',
          heightClassName,
          sizeClassName,
          contentClassName
        )}
        {...(description == null ? { 'aria-describedby': undefined } : {})}
      >
        <ResponsiveModalHeader
          className={cn(
            'border-border shrink-0 space-y-1 border-b px-5 py-3 text-left sm:px-6 sm:py-4',
            headerClassName
          )}
        >
          {typeof title === 'string' ? <ResponsiveModalTitle>{title}</ResponsiveModalTitle> : title}
          {description != null ? (
            typeof description === 'string' ? (
              <ResponsiveModalDescription>{description}</ResponsiveModalDescription>
            ) : (
              description
            )
          ) : null}
        </ResponsiveModalHeader>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch] sm:px-6',
            bodyClassName
          )}
        >
          {children}
        </div>

        <ResponsiveModalFooter
          className={cn(
            'border-border shrink-0 gap-2 border-t px-5 py-3.5 pb-[max(env(safe-area-inset-bottom,0px),0.875rem)] sm:flex-row sm:justify-end sm:px-6 sm:py-4',
            footerClassName
          )}
        >
          {footer}
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
