import type { ReactNode } from 'react';

import { Check } from 'lucide-react';

import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet';
import { cn } from '@/lib/utils';

type MobileChoiceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Native-feeling bottom sheet for pickers on phone/tablet.
 * Pair with desktop DropdownMenu / absolute panels via `useIsBelowLg()`.
 */
export function MobileChoiceSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: MobileChoiceSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className={cn('gap-0', className)}>
        <BottomSheetHeader className="border-border/60 space-y-0 border-b px-4 pb-3 pt-1 text-left">
          <BottomSheetTitle className="text-base font-semibold">{title}</BottomSheetTitle>
          {description ? (
            <BottomSheetDescription className="text-muted-foreground text-sm">
              {description}
            </BottomSheetDescription>
          ) : (
            <BottomSheetDescription className="sr-only">{title}</BottomSheetDescription>
          )}
        </BottomSheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">{children}</div>
        {footer ? (
          <div className="border-border/60 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
  );
}

type MobileChoiceItemProps = {
  selected?: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Optional element pinned to the row's right edge (e.g. a plan `TierBadge`). */
  trailing?: ReactNode;
  disabled?: boolean;
  className?: string;
};

/** Full-width touch row for sheet pickers (≥48px). */
export function MobileChoiceItem({
  selected = false,
  onSelect,
  label,
  description,
  icon,
  trailing,
  disabled = false,
  className,
}: MobileChoiceItemProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left transition-colors',
        'active:bg-muted/70 disabled:pointer-events-none disabled:opacity-40',
        selected ? 'bg-muted/50' : 'hover:bg-muted/40',
        className
      )}
    >
      {icon ? <span className="text-muted-foreground shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'text-foreground block text-sm leading-tight',
            selected ? 'font-semibold' : 'font-medium'
          )}
        >
          {label}
        </span>
        {description ? (
          <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      {selected ? <Check className="text-primary size-5 shrink-0" aria-hidden /> : null}
    </button>
  );
}
