import { Check, ChevronDown } from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { useAdminToolbarMenuOpen } from '@/components/navigation/AdminToolbarMenuScope';
import { type AdminViewToggleOption } from '@/components/navigation/AdminViewToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const isMobileLayout = useIsBelowLg();
  const visible = hideValues.length
    ? options.filter((option) => !hideValues.includes(option.value))
    : options;
  const current = visible.find((option) => option.value === value) ?? visible[0];
  const CurrentIcon = current?.Icon;

  const trigger = (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup={isMobileLayout ? 'dialog' : 'menu'}
      onClick={() => setOpen((next) => !next)}
      className={cn(
        'inline-flex h-10 min-h-[44px] min-w-0 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-foreground',
        'transition-colors hover:bg-muted/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        className
      )}
    >
      {CurrentIcon ? <CurrentIcon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="truncate">{current?.label ?? 'View'}</span>
      <ChevronDown
        className={cn(
          'size-3.5 shrink-0 text-muted-foreground transition-transform',
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10.5rem]">
        {visible.map(({ value: optionValue, label, Icon }) => {
          const selected = optionValue === value;
          return (
            <DropdownMenuItem
              key={optionValue}
              onSelect={() => onChange(optionValue)}
              className="gap-2"
              aria-checked={selected}
              role="menuitemradio"
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="flex-1">{label}</span>
              {selected ? <Check className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
