import { SETTINGS_FIELD_LABEL_COMPACT } from '@/features/dashboard/org/lib/settingsFieldLabel';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
};

export function TelegramModalNumberField({
  id,
  label,
  description,
  value,
  min,
  max,
  disabled,
  className,
  onChange,
}: Props) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={id} className={SETTINGS_FIELD_LABEL_COMPACT}>
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        className="h-10"
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!Number.isFinite(parsed)) return;
          onChange(Math.min(max, Math.max(min, Math.floor(parsed))));
        }}
      />
      <p className="text-muted-foreground text-xs leading-snug">{description}</p>
    </div>
  );
}
