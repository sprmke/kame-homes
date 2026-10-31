import type { ReactNode } from 'react';

import { X } from 'lucide-react';

import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

export type GuestDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plain title string, or custom header content that includes `DialogTitle`. */
  title: ReactNode;
  children: ReactNode;
  /** Pinned action row under a top border (Clear / Save, Back / Continue, …). */
  footer?: ReactNode;
  /**
   * Desktop (`lg+`) width override. Must include both base and `sm:` max-width so
   * we beat DialogContent’s default `sm:max-w-[min(90vw,28rem)]`. Ignored below
   * `lg`, where the shell renders edge-to-edge as a bottom sheet.
   */
  sizeClassName?: string;
  /** Height override. Defaults to a comfortable laptop-safe cap. */
  heightClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  /** Block overlay / Escape dismiss (e.g. nested full-screen layer on top). */
  dismissLocked?: boolean;
};

/**
 * Consistent guest-facing modal chrome: edge-to-edge header + optional footer
 * separators, scrollable body, content padding killed. Centered `Dialog` on
 * `lg+`, bottom sheet below `lg` (via `ResponsiveModal`). Close control lives in
 * the header flex row so it aligns with the title.
 */
export function GuestDialogShell({
  open,
  onOpenChange,
  title,
  children,
  footer,
  sizeClassName = 'max-w-[min(calc(100vw-1.5rem),32rem)] sm:max-w-[min(90vw,32rem)]',
  heightClassName = 'max-h-[min(90dvh,40rem)]',
  bodyClassName,
  headerClassName,
  footerClassName,
  dismissLocked = false,
}: GuestDialogShellProps) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        showCloseButton={false}
        onPointerDownOutside={(event) => {
          if (dismissLocked) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (dismissLocked) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (dismissLocked) event.preventDefault();
        }}
        className={cn(
          'flex w-full flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:p-0',
          heightClassName,
          sizeClassName
        )}
        aria-describedby={undefined}
      >
        <div
          className={cn(
            'border-border flex shrink-0 items-center gap-3 border-b px-5 py-3',
            headerClassName
          )}
        >
          <div className="min-w-0 flex-1">
            {typeof title === 'string' ? (
              <ResponsiveModalTitle className="text-foreground text-base font-semibold tracking-tight">
                {title}
              </ResponsiveModalTitle>
            ) : (
              title
            )}
          </div>

          <ResponsiveModalClose
            className="text-muted-foreground ring-offset-background hover:bg-muted focus:ring-ring flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl opacity-80 transition-all hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
            aria-label="Close"
          >
            <X className="size-5 shrink-0" aria-hidden />
          </ResponsiveModalClose>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4',
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer != null ? (
          <div
            className={cn(
              'border-border shrink-0 border-t px-5 py-3.5 pb-[max(env(safe-area-inset-bottom,0px),0.875rem)]',
              footerClassName
            )}
          >
            {footer}
          </div>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
