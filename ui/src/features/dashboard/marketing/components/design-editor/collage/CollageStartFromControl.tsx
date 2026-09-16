import type { CollageStartFrom } from '@/features/dashboard/marketing/lib/collage/collageTypes';

import { cn } from '@/lib/utils';

const OPTIONS: Array<{ value: CollageStartFrom; label: string }> = [
  { value: 'templates', label: 'Templates' },
  { value: 'collage', label: 'Collage' },
  { value: 'blank', label: 'Blank' },
];

type Props = {
  value: CollageStartFrom;
  onChange: (value: CollageStartFrom) => void;
};

export function CollageStartFromControl({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
        Start from
      </p>
      <div
        role="radiogroup"
        aria-label="Start from"
        className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={cn(
              'min-h-[36px] rounded-md px-2 text-xs font-medium transition-colors',
              value === option.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
