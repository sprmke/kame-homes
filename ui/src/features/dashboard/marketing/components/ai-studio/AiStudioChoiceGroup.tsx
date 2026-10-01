import { useId, type ReactNode } from 'react';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

import { cn } from '@/lib/utils';

export type AiStudioChoice<T extends string> = {
  value: T;
  label: string;
  /** Second line under the label (platform, credits, …). */
  hint?: string;
  /** Leading visual, e.g. a shape preview. */
  visual?: ReactNode;
  disabled?: boolean;
};

type Props<T extends string> = {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: AiStudioChoice<T>[];
  columns?: 2 | 3 | 4;
  disabled?: boolean;
  /** Right side of the label row. */
  trailing?: ReactNode;
};

/** Outline of the output shape, drawn at its real ratio inside a 20px box. */
export function AiStudioShapePreview({ ratio }: { ratio: number }) {
  const max = 20;
  const width = ratio >= 1 ? max : Math.round(max * ratio);
  const height = ratio >= 1 ? Math.round(max / ratio) : max;
  return (
    <span className="flex h-5 items-center justify-center" aria-hidden>
      <span
        className="block rounded-[3px] border-[1.5px] border-current opacity-70"
        style={{ width, height }}
      />
    </span>
  );
}

const COLUMNS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 min-[400px]:grid-cols-4',
};

/**
 * Card-style single choice (Format, Quality, Length). Radix radio group, so arrow keys
 * move the selection and screen readers announce "n of m".
 */
export function AiStudioChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  columns = 2,
  disabled,
  trailing,
}: Props<T>) {
  const labelId = useId();

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId} className="settings-field-label">
          {label}
        </span>
        {trailing}
      </div>
      <RadioGroupPrimitive.Root
        value={value}
        onValueChange={(next) => onChange(next as T)}
        aria-labelledby={labelId}
        disabled={disabled}
        className={cn('grid gap-2', COLUMNS[columns])}
      >
        {options.map((option) => (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            aria-label={option.hint ? `${option.label}, ${option.hint}` : option.label}
            className={cn(
              'border-border/80 bg-background text-foreground flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center',
              'transition-[border-color,background-color,box-shadow] duration-150 ease-out',
              'hover:border-primary/40 hover:bg-muted/40',
              'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'data-[state=checked]:border-primary data-[state=checked]:bg-primary/[0.06] data-[state=checked]:shadow-[inset_0_0_0_1px_hsl(var(--primary))]',
              'disabled:hover:border-border/80 disabled:hover:bg-background disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {option.visual}
            <span className="text-[13px] font-semibold leading-tight">{option.label}</span>
            {option.hint && (
              <span className="text-muted-foreground text-[11px] tabular-nums leading-tight">
                {option.hint}
              </span>
            )}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  );
}
