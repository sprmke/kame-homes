import type { ReactNode } from 'react';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  badge?: ReactNode;
};

export function TelegramToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
  className,
  compact,
  badge,
}: Props) {
  return (
    <div
      className={cn(
        'flex min-h-[44px] items-center justify-between gap-3',
        compact ? 'py-0.5' : 'py-1',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={id}
            className="text-foreground cursor-pointer text-sm font-medium leading-snug"
          >
            {label}
          </label>
          {badge}
        </div>
        {hint ? (
          <p className="text-muted-foreground truncate text-xs leading-snug">{hint}</p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onChange}
      />
    </div>
  );
}
