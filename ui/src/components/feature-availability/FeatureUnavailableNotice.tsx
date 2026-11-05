import type { FeatureAvailabilityTone } from '@/lib/featureAvailability/featureAvailabilityCopy';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  label: string;
  expectedBackLabel?: string | null;
  tone?: FeatureAvailabilityTone;
  className?: string;
};

export function FeatureUnavailableNotice({
  title,
  label,
  expectedBackLabel,
  tone = 'amber',
  className,
}: Props) {
  const isAmber = tone === 'amber';
  return (
    <div
      role="status"
      className={cn(
        'rounded-lg border px-3 py-2.5 text-sm',
        isAmber
          ? 'text-foreground border-amber-500/30 bg-amber-500/10'
          : 'border-border bg-muted/50 text-foreground',
        className
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mt-0.5 text-xs sm:text-[13px]">
        {label}
        {expectedBackLabel ? ` ${expectedBackLabel}` : null}
      </p>
    </div>
  );
}
