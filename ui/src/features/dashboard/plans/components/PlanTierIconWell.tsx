import { planTierIcon, planTierIconWellClass } from '@/features/dashboard/plans/lib/planTierIcons';

import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, { box: string; icon: string; strokeWidth: number }> = {
  sm: { box: 'size-9 rounded-xl', icon: 'size-4', strokeWidth: 1.5 },
  md: { box: 'size-10 rounded-xl', icon: 'size-5', strokeWidth: 1.5 },
  lg: { box: 'size-12 rounded-full', icon: 'size-6', strokeWidth: 1.75 },
};

type Props = {
  planCode: string;
  size?: Size;
  muted?: boolean;
  className?: string;
};

export function PlanTierIconWell({ planCode, size = 'md', muted = false, className }: Props) {
  const Icon = planTierIcon(planCode);
  const dimensions = SIZE[size];

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center',
        dimensions.box,
        planTierIconWellClass(planCode, muted),
        className
      )}
      aria-hidden
    >
      <Icon className={dimensions.icon} strokeWidth={dimensions.strokeWidth} />
    </span>
  );
}
