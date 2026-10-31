import { ORG_PROPERTY_STATUSES } from '@/features/dashboard/org/lib/orgPropertyDisplay';

import { semanticBadgeClasses, semanticBadgeDotClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

type Props = {
  status: string;
  className?: string;
};

export function OrgPropertyStatusBadge({ status, className }: Props) {
  const config = ORG_PROPERTY_STATUSES.find((entry) => entry.value === status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        config?.badgeClassName ?? semanticBadgeClasses('neutral'),
        className
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          config?.dotClassName ?? semanticBadgeDotClasses('neutral')
        )}
        aria-hidden
      />
      {config?.label ?? status}
    </span>
  );
}
