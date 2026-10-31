import { useRef } from 'react';

import { Check, ChevronDown } from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { useAdminToolbarMenuOpen } from '@/components/navigation/AdminToolbarMenuScope';
import { useDismissOnOutsideClick } from '@/hooks/useDismissOnOutsideClick';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export type AdminSingleSelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: AdminSingleSelectOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  triggerWidthClassName?: string;
  isActive?: (value: T) => boolean;
  panelAlign?: 'left' | 'right';
  panelWidthClassName?: string;
  /** Keep parent Filters/Status open when this menu toggles (nested in popover). */
  toolbarExclusive?: boolean;
};

export function AdminSingleSelectFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  triggerWidthClassName = 'sm:w-[8.75rem]',
  isActive = (v) => v !== ('all' as T),
  panelAlign = 'right',
  panelWidthClassName = 'w-[min(calc(100vw-24px),12rem)]',
  toolbarExclusive = true,
}: Props<T>) {
  const [open, setOpen] = useAdminToolbarMenuOpen(undefined, { exclusive: toolbarExclusive });
  const ref = useRef<HTMLDivElement>(null);
  const isMobileLayout = useIsBelowLg();
  const close = () => setOpen(false);
  useDismissOnOutsideClick(ref, open && !isMobileLayout, close);

  const label = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? '';

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      aria-haspopup={isMobileLayout ? 'dialog' : 'listbox'}
      className={cn(
        'inline-flex min-h-[44px] w-full items-center justify-between gap-1.5 rounded-lg border px-3 py-2.5 text-[13px] font-semibold',
        'lg:h-10 lg:py-0',
        triggerWidthClassName,
        open || isActive(value)
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/60'
      )}
    >
      <span className="truncate">{label}</span>
      <ChevronDown
        className={cn('size-3.5 shrink-0 transition-transform duration-150', open && 'rotate-180')}
        aria-hidden
      />
    </button>
  );

  if (isMobileLayout) {
    return (
      <div className="relative min-w-0">
        {trigger}
        <MobileChoiceSheet open={open} onOpenChange={setOpen} title={ariaLabel}>
          <div role="listbox" aria-label={ariaLabel}>
            {options.map((option) => {
              const selected = value === option.value;
              return (
                <MobileChoiceItem
                  key={option.value}
                  selected={selected}
                  label={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    close();
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
    <div ref={ref} className="relative min-w-0">
      {trigger}
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            'border-border/50 bg-popover shadow-elevated-lg dark:border-border/20 absolute z-50 mt-1.5 overflow-hidden rounded-xl border',
            panelAlign === 'left' ? 'left-0' : 'right-0',
            panelWidthClassName
          )}
        >
          <div className="py-1">
            {options.map((option) => {
              const selected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] transition-colors',
                    selected
                      ? 'bg-muted/50 text-foreground font-semibold'
                      : 'text-foreground/80 hover:bg-muted/50 font-medium'
                  )}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                >
                  <span className="flex-1">{option.label}</span>
                  {selected ? (
                    <Check className="text-primary size-3.5 shrink-0" aria-hidden />
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
