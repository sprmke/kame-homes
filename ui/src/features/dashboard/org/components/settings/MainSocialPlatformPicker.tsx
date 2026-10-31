import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type SocialUrlMap,
} from '@/features/dashboard/org/lib/socialPlatformTypes';

import { cn } from '@/lib/utils';

type Props = {
  id: string;
  value: SocialPlatform | '';
  urls: SocialUrlMap;
  disabled?: boolean;
  error?: string | null;
  onChange: (platform: SocialPlatform) => void;
  onInteract: () => void;
};

export function MainSocialPlatformPicker({
  id,
  value,
  urls,
  disabled,
  error,
  onChange,
  onInteract,
}: Props) {
  const availablePlatforms = SOCIAL_PLATFORMS.filter((platform) => Boolean(urls[platform].trim()));

  if (availablePlatforms.length === 0) return null;

  const gridClass =
    availablePlatforms.length === 1
      ? 'grid-cols-1'
      : availablePlatforms.length === 2
        ? 'grid-cols-2'
        : availablePlatforms.length === 3
          ? 'grid-cols-3'
          : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div className="space-y-2">
      <p id={`${id}-label`} className="text-sm font-medium">
        Guest review link
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-invalid={Boolean(error)}
        className={cn('grid gap-2', gridClass)}
      >
        {availablePlatforms.map((platform) => {
          const selected = value === platform;
          return (
            <button
              key={platform}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => {
                onInteract();
                onChange(platform);
              }}
              className={cn(
                'border-border flex min-h-[44px] items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {SOCIAL_PLATFORM_LABELS[platform]}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
