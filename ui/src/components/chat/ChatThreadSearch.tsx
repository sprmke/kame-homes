import { useEffect, useRef } from 'react';

import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SearchPanelProps = {
  query: string;
  onQueryChange: (query: string) => void;
  matchCount: number;
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  className?: string;
};

export function ChatThreadSearchPanel({
  query,
  onQueryChange,
  matchCount,
  activeIndex,
  onPrev,
  onNext,
  onClose,
  className,
}: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const counterLabel =
    query.trim() && matchCount > 0 ? `${activeIndex + 1}/${matchCount}` : query.trim() ? '0' : null;

  return (
    <div
      className={cn(
        'border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/90 z-20 flex shrink-0 items-center gap-1.5 border-b px-2.5 py-1.5 shadow-sm backdrop-blur-sm sm:gap-2 sm:px-3',
        className
      )}
      role="search"
    >
      <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search in conversation"
        className="h-7 min-h-[30px] flex-1 border-0 bg-transparent shadow-none"
        aria-label="Search in conversation"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) onPrev();
            else onNext();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      {counterLabel ? (
        <span
          className="text-muted-foreground shrink-0 text-[11px] tabular-nums sm:text-xs"
          aria-live="polite"
        >
          {counterLabel}
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 min-h-[36px] min-w-[36px] shrink-0"
        disabled={!matchCount}
        aria-label="Previous match"
        onClick={onPrev}
      >
        <ChevronUp className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 min-h-[36px] min-w-[36px] shrink-0"
        disabled={!matchCount}
        aria-label="Next match"
        onClick={onNext}
      >
        <ChevronDown className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 min-h-[36px] min-w-[36px] shrink-0"
        aria-label="Close search"
        onClick={onClose}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

type TriggerProps = {
  onClick: () => void;
  active?: boolean;
  className?: string;
  /** `toolbar` = compact circular control for guest chat header. */
  variant?: 'default' | 'muted' | 'toolbar';
};

export function ChatThreadSearchTrigger({
  onClick,
  active = false,
  className,
  variant = 'default',
}: TriggerProps) {
  if (variant === 'toolbar') {
    return (
      <button
        type="button"
        className={cn(
          'text-muted-foreground hover:text-foreground border-border/60 bg-muted/25 hover:bg-muted/50 inline-flex size-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border transition-colors',
          active && 'border-primary/35 bg-primary/5 text-primary',
          className
        )}
        aria-label="Search in conversation"
        aria-pressed={active}
        onClick={onClick}
      >
        <Search className="size-[18px]" aria-hidden />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'min-h-[44px] min-w-[44px] shrink-0',
        variant === 'muted' && 'text-muted-foreground hover:text-foreground',
        active && 'bg-muted text-foreground',
        className
      )}
      aria-label="Search in conversation"
      aria-pressed={active}
      onClick={onClick}
    >
      <Search className="size-4" aria-hidden />
    </Button>
  );
}
