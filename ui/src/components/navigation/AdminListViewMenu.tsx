import { useRef } from 'react';

import { Check, ChevronDown } from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { useAdminToolbarMenuOpen } from '@/components/navigation/AdminToolbarMenuScope';
import { type AdminViewToggleOption } from '@/components/navigation/AdminViewToggle';
import { useDismissOnOutsideClick } from '@/hooks/useDismissOnOutsideClick';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type Props<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: AdminViewToggleOption<T>[];
  hideValues?: T[];
  className?: string;
  ariaLabel?: string;
};

/** Desktop-friendly view picker — one compact trigger instead of a segmented strip. */
export function AdminListViewMenu<T extends string>({
  value,
  onChange,
  options,
  hideValues = [],
  className,
  ariaLabel = 'Choose list view',
}: Props<T>) {
  const [open, setOpen] = useAdminToolbarMenuOpen();
  const ref = useRef<HTMLDivElement>(null);
  const isMobileLayout = useIsBelowLg();
  const visible = hideValues.length
    ? options.filter((option) => !hideValues.includes(option.value))
    : options;
  const current = visible.find((option) => option.value === value) ?? visible[0];
  const CurrentIcon = current?.Icon;

  useDismissOnOutsideClick(ref, open && !isMobileLayout, () => setOpen(false));

  const trigger = (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup={isMobileLayout ? 'dialog' : 'listbox'}
      onClick={() => setOpen((next) => !next)}
      className={cn(
        'border-border bg-card text-foreground inline-flex h-10 min-h-[44px] min-w-0 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold',
        'hover:bg-muted/60 transition-colors',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        className
      )}
    >
      {CurrentIcon ? <CurrentIcon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="truncate">{current?.label ?? 'View'}</span>
      <ChevronDown
        className={cn(
          'text-muted-foreground size-3.5 shrink-0 transition-transform',
          open && 'rotate-180'
        )}
        aria-hidden
      />
    </button>
  );

  if (isMobileLayout) {
    return (
      <>
        {trigger}
        <MobileChoiceSheet open={open} onOpenChange={setOpen} title={ariaLabel}>
          <div role="listbox" aria-label={ariaLabel}>
            {visible.map(({ value: optionValue, label, Icon }) => {
              const selected = optionValue === value;
              return (
                <MobileChoiceItem
                  key={optionValue}
                  selected={selected}
                  label={label}
                  icon={<Icon className="size-5" aria-hidden />}
                  onSelect={() => {
                    onChange(optionValue);
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
        </MobileChoiceSheet>
      </>
    );
  }

  return (
    <div ref={ref} className="relative min-w-0">
      {trigger}
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="border-border/50 bg-popover text-popover-foreground shadow-elevated-lg dark:border-border/20 absolute right-0 z-50 mt-1.5 min-w-[10.5rem] overflow-hidden rounded-xl border p-1.5"
        >
          {visible.map(({ value: optionValue, label, Icon }) => {
            const selected = optionValue === value;
            return (
              <button
                key={optionValue}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  'flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors',
                  selected
                    ? 'bg-muted/50 text-foreground font-semibold'
                    : 'text-foreground/80 hover:bg-muted/50 font-medium'
                )}
                onClick={() => {
                  onChange(optionValue);
                  setOpen(false);
                }}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="flex-1 text-left">{label}</span>
                {selected ? <Check className="text-primary size-3.5 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
