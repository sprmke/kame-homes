import { FeatureAvailabilityReasonIcon } from '@/components/feature-availability/FeatureAvailabilityReasonIcon';
import { featureAvailabilityReasonIcon } from '@/lib/featureAvailability/featureAvailabilityCopy';
import type { FeatureAvailabilityTone } from '@/lib/featureAvailability/featureAvailabilityCopy';
import type { FeatureAvailabilityReason } from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  message: string;
  expectedBackLabel?: string | null;
  reason?: FeatureAvailabilityReason | null;
  tone?: FeatureAvailabilityTone;
  className?: string;
  compact?: boolean;
};

export function FeatureUnavailablePanel({
  label,
  message,
  expectedBackLabel,
  reason = null,
  tone = 'neutral',
  className,
  compact = false,
}: Props) {
  const iconName = featureAvailabilityReasonIcon(reason);
  const isAmber = tone === 'amber';

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'gap-2 px-2 py-3' : 'gap-3 px-4 py-8 sm:py-10',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          compact ? 'h-10 w-10' : 'h-12 w-12',
          isAmber
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <FeatureAvailabilityReasonIcon
          name={iconName}
          className={compact ? 'h-5 w-5' : 'h-6 w-6'}
        />
      </div>
      <div className="max-w-md space-y-1">
        <p className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>{label}</p>
        <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>{message}</p>
        {expectedBackLabel ? (
          <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
            {expectedBackLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
