import { cn } from '@/lib/utils';

export type SwitchProps = {
  id?: string;
  checked: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  onCheckedChange: (checked: boolean) => void;
};

export function Switch({
  id,
  checked,
  disabled,
  className,
  'aria-label': ariaLabel,
  onCheckedChange,
}: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'bg-background pointer-events-none block size-5 rounded-full shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
