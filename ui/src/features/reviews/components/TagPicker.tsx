import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface TagPickerOption {
  id: string;
  label: string;
}

export interface TagPickerProps {
  label: string;
  options: TagPickerOption[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  disabled?: boolean;
}

/** Multi-select pill list. Used for guest feedback tags and host strength/issue tags. */
export function TagPicker({
  label,
  options,
  value,
  onChange,
  max = 6,
  disabled = false,
}: TagPickerProps) {
  const toggle = (id: string) => {
    if (disabled) return;
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, id]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = value.includes(option.id);
          const atCap = !selected && value.length >= max;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled || atCap}
              onClick={() => toggle(option.id)}
              className={cn(
                'min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-45',
                selected
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-card text-foreground hover:border-primary/35 hover:bg-muted/40'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
