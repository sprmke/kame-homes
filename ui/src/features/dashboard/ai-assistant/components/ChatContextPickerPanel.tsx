import type { ReactNode, RefObject, WheelEventHandler, PointerEventHandler } from 'react';

import { ChevronLeft, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  view: 'modules' | 'items';
  moduleTitle?: string;
  onBack?: () => void;
  searchRef?: RefObject<HTMLInputElement | null>;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchAriaLabel: string;
  listAriaLabel: string;
  isLoading?: boolean;
  emptyLabel: string;
  hasRows: boolean;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  onWheelStop?: WheelEventHandler<HTMLDivElement>;
  onPointerDownStop?: PointerEventHandler<HTMLDivElement>;
};

export function ChatContextPickerPanel({
  view,
  moduleTitle,
  onBack,
  searchRef,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  listAriaLabel,
  isLoading,
  emptyLabel,
  hasRows,
  footer,
  children,
  className,
  onWheelStop,
  onPointerDownStop,
}: Props) {
  return (
    <div className={cn('flex flex-col', className)}>
      {view === 'items' && moduleTitle && onBack ? (
        <div className="border-border/60 flex items-center gap-0.5 border-b px-1 py-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            aria-label="Back to modules"
            onClick={onBack}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="text-foreground min-w-0 flex-1 truncate px-1 text-sm font-medium">
            {moduleTitle}
          </span>
        </div>
      ) : null}

      <div className="border-border/60 relative border-b p-2">
        <Search
          className="text-muted-foreground pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          ref={searchRef}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && searchValue === '' && view === 'items' && onBack) {
              e.preventDefault();
              onBack();
            }
          }}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
          className="h-10 ps-9"
        />
      </div>

      <div
        role="listbox"
        aria-label={listAriaLabel}
        className="max-h-72 touch-pan-y overflow-y-auto overscroll-contain p-1.5 [-webkit-overflow-scrolling:touch]"
        onWheel={onWheelStop}
        onTouchMove={(event) => event.stopPropagation()}
        onPointerDown={onPointerDownStop}
      >
        {isLoading ? (
          <div className="space-y-1 p-1" aria-busy="true">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : !hasRows ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">{emptyLabel}</p>
        ) : (
          children
        )}
      </div>

      {footer ? <div className="border-border/60 border-t p-1.5">{footer}</div> : null}
    </div>
  );
}
