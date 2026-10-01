import {
  Aperture,
  Camera,
  CloudRain,
  Lamp,
  MoonStar,
  Sun,
  Sunset,
  type LucideIcon,
} from 'lucide-react';

import { GENERATION_LOOKS } from '@/features/dashboard/marketing/lib/marketingGenerationOptions';

import { cn } from '@/lib/utils';

const LOOK_ICONS: Record<string, LucideIcon> = {
  'golden-hour': Sunset,
  'bright-airy': Sun,
  'evening-glow': Lamp,
  'blue-hour': MoonStar,
  'rainy-cozy': CloudRain,
  editorial: Camera,
  detail: Aperture,
};

type Props = {
  value: string | null;
  onChange: (lookId: string | null) => void;
  disabled?: boolean;
};

/**
 * Optional lighting / mood. Stacks on top of the description rather than replacing
 * it; tapping the picked look again clears it.
 */
export function AiStudioLookPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id="ai-studio-look-label" className="settings-field-label">
          Look
        </span>
        <span className="text-muted-foreground text-xs">Optional</span>
      </div>
      <div role="group" aria-labelledby="ai-studio-look-label" className="flex flex-wrap gap-1.5">
        {GENERATION_LOOKS.map((look) => {
          const Icon = LOOK_ICONS[look.id] ?? Sun;
          const selected = value === look.id;
          return (
            <button
              key={look.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(selected ? null : look.id)}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium sm:min-h-9',
                'transition-[border-color,background-color,color] duration-150 ease-out',
                'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/80 bg-background text-foreground hover:bg-muted/60'
              )}
            >
              <Icon
                className={cn('size-3.5', selected ? 'opacity-100' : 'text-muted-foreground')}
                aria-hidden
              />
              {look.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
