import {
  lifecyclePresentation,
  resolvePropertyLifecycleState,
} from '@/features/dashboard/org/lib/propertyLifecycle';
import type { Property } from '@/features/dashboard/org/types';

import { semanticBadgeClasses, semanticBadgeDotClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

type Props = {
  property: Pick<Property, 'status' | 'inactiveReason'>;
  className?: string;
};

/** One badge per host-facing lifecycle state (live / paused / pending / suspended / archived). */
export function PropertyLifecycleBadge({ property, className }: Props) {
  const presentation = lifecyclePresentation(
    resolvePropertyLifecycleState({
      status: property.status,
      inactiveReason: property.inactiveReason,
    })
  );

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        semanticBadgeClasses(presentation.variant),
        className
      )}
    >
      <span
        className={cn('size-1.5 rounded-full', semanticBadgeDotClasses(presentation.variant))}
        aria-hidden
      />
      {presentation.label}
    </span>
  );
}
