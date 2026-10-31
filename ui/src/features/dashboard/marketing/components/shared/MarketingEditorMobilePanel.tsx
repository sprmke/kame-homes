import type { ReactNode } from 'react';

import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Optional controls rendered on the sheet header row (e.g. a section switcher). */
  headerAside?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * Bottom-sheet host for a Marketing Studio editor's side panel on mobile (`max-lg`).
 *
 * Desktop keeps the inline `MarketingEditorSidebar` column; below `lg` the same panel
 * content is presented here so the editor canvas can go full-bleed. Uses the shared
 * split-layout bottom sheet so tall panel content gets a real inner scrollport.
 */
export function MarketingEditorMobilePanel({
  open,
  onOpenChange,
  title,
  description,
  headerAside,
  children,
  footer,
  className,
  bodyClassName,
}: Props) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        layout="split"
        className={cn('h-[min(80dvh,42rem)] max-h-[min(80dvh,42rem)] overflow-hidden', className)}
      >
        <BottomSheetHeader className="border-border shrink-0 gap-1 border-b px-4 pb-3 pt-1 text-left">
          <div className="flex items-center justify-between gap-3">
            <BottomSheetTitle className="text-base font-semibold">{title}</BottomSheetTitle>
            {headerAside ? (
              <div className="flex shrink-0 items-center gap-1">{headerAside}</div>
            ) : null}
          </div>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </BottomSheetHeader>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]',
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="border-border bg-card shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
  );
}
