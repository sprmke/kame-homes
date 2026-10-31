import type { ComponentProps, ComponentType, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ChatComposerPickerTrigger({
  icon: Icon,
  label,
  pressed,
  disabled,
  className,
  ...props
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  pressed: boolean;
} & ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      {...props}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        'min-h-[44px] min-w-[44px] shrink-0',
        pressed ? 'text-primary' : undefined,
        className
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}

export function ChatComposerPickerRow({
  title,
  subtitle,
  trailing,
  hint,
  selected,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left',
        'focus-visible:outline-none focus-visible:ring-2',
        selected ? 'bg-primary/10' : 'hover:bg-muted/60'
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">{title}</span>
        {subtitle || hint ? (
          <span className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs">
            {subtitle ? <span className="truncate">{subtitle}</span> : null}
            {hint ? <span className="text-primary shrink-0 font-medium">{hint}</span> : null}
          </span>
        ) : null}
      </span>
      {trailing}
    </button>
  );
}
