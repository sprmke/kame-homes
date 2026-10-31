import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ListingFilterChip = {
  id: string;
  label: string;
};

type Props = {
  chips: ListingFilterChip[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  className?: string;
};

/** Dismissible chips for applied listing filters (results column). */
export function ListingActiveFilterChips({ chips, onRemove, onClearAll, className }: Props) {
  if (chips.length === 0) return null;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="list"
      aria-label="Applied filters"
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          role="listitem"
          onClick={() => onRemove(chip.id)}
          className="border-border bg-muted/60 text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
          aria-label={`Remove filter ${chip.label}`}
        >
          <span className="truncate">{chip.label}</span>
          <X className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      ))}
      {onClearAll && chips.length > 1 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-muted-foreground hover:text-foreground min-h-[36px] px-2"
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}
