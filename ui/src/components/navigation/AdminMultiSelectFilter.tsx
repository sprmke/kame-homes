import { useMemo, useRef } from 'react';

import { Check, ChevronDown } from 'lucide-react';

import { useAdminToolbarMenuOpen } from '@/components/navigation/AdminToolbarMenuScope';
import { useDismissOnOutsideClick } from '@/hooks/useDismissOnOutsideClick';
import { cn } from '@/lib/utils';

export type AdminMultiSelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: AdminMultiSelectOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  emptyLabel: string;
  pluralUnit: string;
  ariaLabel: string;
  triggerWidthClassName?: string;
  panelScrollable?: boolean;
  emptyMessage?: string;
  panelAlign?: 'left' | 'right';
  panelWidthClassName?: string;
  /** Keep parent Filters/Status open when this menu toggles (nested in popover). */
  toolbarExclusive?: boolean;
};

export function AdminMultiSelectFilter<T extends string>({
  options,
  value,
  onChange,
  emptyLabel,
  pluralUnit,
  ariaLabel,
  triggerWidthClassName = 'sm:w-[9.5rem]',
  panelScrollable = false,
  emptyMessage,
  panelAlign = 'right',
  panelWidthClassName = 'w-[min(calc(100vw-24px),12rem)]',
  toolbarExclusive = true,
}: Props<T>) {
  const [open, setOpen] = useAdminToolbarMenuOpen(undefined, { exclusive: toolbarExclusive });
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useDismissOnOutsideClick(ref, open, close);

  const label = useMemo(() => {
    if (value.length === 0) return emptyLabel;
    if (value.length === 1) {
      return options.find((o) => o.value === value[0])?.label ?? emptyLabel;
    }
    return `${value.length} ${pluralUnit}`;
  }, [emptyLabel, options, pluralUnit, value]);

  function toggle(next: T) {
    if (value.includes(next)) {
      onChange(value.filter((item) => item !== next));
      return;
    }
    onChange([...value, next]);
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'inline-flex min-h-[44px] w-full items-center justify-between gap-1.5 rounded-lg border px-3 py-2.5 text-[13px] font-semibold',
          'lg:h-10 lg:py-0',
          triggerWidthClassName,
          open || value.length > 0
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/60'
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-150',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            'border-border/50 bg-popover shadow-elevated-lg dark:border-border/20 absolute z-50 mt-1.5 rounded-xl border',
            panelAlign === 'left' ? 'left-0' : 'right-0',
            panelWidthClassName,
            panelScrollable ? 'max-h-[60vh] overflow-y-auto' : 'overflow-hidden'
          )}
        >
          <div className="py-1">
            {options.length === 0 && emptyMessage ? (
              <p className="text-muted-foreground px-3.5 py-2.5 text-[13px]">{emptyMessage}</p>
            ) : (
              options.map((option) => {
                const selected = value.includes(option.value);
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
                    onClick={() => toggle(option.value)}
                  >
                    <span className="flex-1 truncate">{option.label}</span>
                    {selected ? (
                      <Check className="text-primary size-3.5 shrink-0" aria-hidden />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
