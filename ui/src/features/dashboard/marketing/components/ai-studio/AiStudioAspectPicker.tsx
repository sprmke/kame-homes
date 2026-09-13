import {
  IMAGE_ASPECT_RATIO_OPTIONS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  type AspectRatioOption,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import type { MarketingGenerationMediaType } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  mediaType: MarketingGenerationMediaType;
  value: string;
  onChange: (aspectRatio: string) => void;
  disabled?: boolean;
};

function AspectPreview({ option }: { option: AspectRatioOption }) {
  const max = 22;
  const width = option.ratio >= 1 ? max : Math.round(max * option.ratio);
  const height = option.ratio >= 1 ? Math.round(max / option.ratio) : max;

  return (
    <span
      className="border-foreground/40 bg-background/80 block rounded-[3px] border"
      style={{ width, height }}
      aria-hidden
    />
  );
}

/** Visual shape picker — always visible, like Canva / Ideogram format chips. */
export function AiStudioAspectPicker({ mediaType, value, onChange, disabled }: Props) {
  const options = mediaType === 'video' ? VIDEO_ASPECT_RATIO_OPTIONS : IMAGE_ASPECT_RATIO_OPTIONS;

  return (
    <div className="space-y-1.5">
      <Label className="settings-field-label">Shape</Label>
      <div role="radiogroup" aria-label="Shape" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'border-border/70 hover:border-primary/40 hover:bg-muted/40 flex min-h-[52px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-center transition-colors',
                selected && 'border-primary bg-primary/5 ring-primary/30 ring-1',
                disabled && 'opacity-60'
              )}
            >
              <AspectPreview option={option} />
              <span className="text-foreground text-[11px] font-medium leading-tight">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
