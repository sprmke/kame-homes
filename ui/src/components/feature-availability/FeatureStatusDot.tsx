import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** Accessible label when the dot is meaningful on its own. */
  label?: string;
};

export function FeatureStatusDot({ className, label = 'Feature unavailable' }: Props) {
  return (
    <span
      className={cn(
        'ring-background inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-2',
        className
      )}
      title={label}
      aria-label={label}
    />
  );
}
