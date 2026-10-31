import { useRef } from 'react';

import { ArrowUpDown, Check, ChevronDown } from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { useAdminToolbarMenuOpen } from '@/components/navigation/AdminToolbarMenuScope';
import { useDismissOnOutsideClick } from '@/hooks/useDismissOnOutsideClick';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export type AdminSortOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type Props<T extends string> = {
  sort: T;
  onChange: (sort: T) => void;
  options: readonly AdminSortOption<T>[];
  ariaLabel: string;
  fullWidth?: boolean;
  menuWidthClass?: string;
  resolveLabel?: (sort: T, options: readonly AdminSortOption<T>[]) => string;
};

export function AdminSortMenu<T extends string>({
  sort,
  onChange,
  options,
  ariaLabel,
  fullWidth = false,
  menuWidthClass = 'w-[min(calc(100vw-24px),14rem)]',
  resolveLabel,
}: Props<T>) {
  const [open, setOpen] = useAdminToolbarMenuOpen();
  const ref = useRef<HTMLDivElement>(null);
  const isMobileLayout = useIsBelowLg();
  const label =
    resolveLabel?.(sort, options) ??
    options.find((option) => option.value === sort)?.label ??
    'Sort';

  useDismissOnOutsideClick(ref, open && !isMobileLayout, () => setOpen(false));

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      aria-haspopup={isMobileLayout ? 'dialog' : 'listbox'}
      className={cn(
        'inline-flex min-h-[44px] min-w-0 max-w-[11.5rem] items-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold',
        'select-none border transition-all duration-100 lg:h-10 lg:max-w-[13rem] lg:rounded-lg lg:py-0',
        'native-press',
        fullWidth && 'w-full max-w-none justify-center sm:w-auto sm:max-w-[13rem] sm:justify-start',
        open
          ? 'interactive-primary border-border'
          : 'border-border bg-card text-foreground hover:bg-muted/60'
      )}
    >
      <ArrowUpDown className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
      <ChevronDown
        className={cn('size-3.5 shrink-0 transition-transform duration-150', open && 'rotate-180')}
        aria-hidden
      />
    </button>
  );

  if (isMobileLayout) {
    return (
      <div className={cn('relative min-w-0', fullWidth && 'w-full sm:w-auto')}>
        {trigger}
        <MobileChoiceSheet open={open} onOpenChange={setOpen} title={ariaLabel}>
          <div role="listbox" aria-label={ariaLabel}>
            {options.map((option) => {
              const selected = sort === option.value;
              return (
                <MobileChoiceItem
                  key={option.value}
                  selected={selected}
                  label={option.label}
                  description={option.description}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
        </MobileChoiceSheet>
      </div>
    );
  }

  return (
    <div ref={ref} className={cn('relative min-w-0', fullWidth && 'w-full sm:w-auto')}>
      {trigger}
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            'border-border/50 bg-popover shadow-elevated-lg dark:border-border/20 absolute left-0 z-50 mt-1.5 overflow-hidden rounded-xl border',
            menuWidthClass
          )}
        >
          <div className="py-1">
            {options.map((option) => {
              const selected = sort === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'flex w-full items-start gap-2 px-3.5 py-2.5 text-left transition-colors',
                    selected
                      ? 'bg-muted/50 text-foreground font-semibold'
                      : 'text-foreground/80 hover:bg-muted/50 font-medium'
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]">{option.label}</span>
                    {option.description ? (
                      <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <Check className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
