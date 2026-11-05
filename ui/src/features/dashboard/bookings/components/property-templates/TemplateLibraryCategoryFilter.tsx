import * as React from 'react';

import { Check, ListFilter } from 'lucide-react';

import type { TemplateCategoryFilter } from '@/features/dashboard/bookings/lib/templateLibrary';

import { AdminMobileFilterButton } from '@/components/mobile/AdminListRefineSheet';
import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const FILTER_OPTIONS: { value: TemplateCategoryFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'email', label: 'Emails' },
  { value: 'standard', label: 'Stay guide' },
  { value: 'custom', label: 'Custom' },
];

type Props = {
  value: TemplateCategoryFilter;
  onChange: (value: TemplateCategoryFilter) => void;
};

function FilterOptions({ value, onChange, onPick }: Props & { onPick?: () => void }) {
  return (
    <div className="p-1" role="listbox" aria-label="Template type">
      {FILTER_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => {
              onChange(option.value);
              onPick?.();
            }}
            className={cn(
              'flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors',
              'hover:bg-muted focus-visible:bg-muted',
              selected && 'text-primary font-medium'
            )}
          >
            <span className="min-w-0 flex-1">{option.label}</span>
            {selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TemplateLibraryCategoryFilter({ value, onChange }: Props) {
  const isMobile = useIsBelowLg();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const activeCount = value === 'all' ? 0 : 1;

  if (isMobile) {
    return (
      <>
        <AdminMobileFilterButton
          count={activeCount}
          open={sheetOpen}
          onClick={() => setSheetOpen(true)}
          aria-label="Filter template type"
        />
        <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Template type">
          {FILTER_OPTIONS.map((option) => (
            <MobileChoiceItem
              key={option.value}
              label={option.label}
              selected={value === option.value}
              onSelect={() => {
                onChange(option.value);
                setSheetOpen(false);
              }}
            />
          ))}
        </MobileChoiceSheet>
      </>
    );
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter template type"
          aria-expanded={popoverOpen}
          className={cn(
            'border-border relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors',
            'focus-visible:ring-ring min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            activeCount > 0
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          )}
        >
          <ListFilter className="size-4" aria-hidden />
          {activeCount > 0 ? (
            <span className="bg-primary-strong text-primary-foreground absolute -right-1 -top-1 inline-flex size-[18px] items-center justify-center rounded-full text-[10px] font-bold">
              1
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-44 p-0">
        <FilterOptions value={value} onChange={onChange} onPick={() => setPopoverOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
