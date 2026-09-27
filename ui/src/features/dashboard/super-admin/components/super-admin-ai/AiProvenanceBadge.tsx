import { SOURCE_LABEL, type AiLimitSource } from '@/features/dashboard/super-admin/lib/aiLimits';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type AiProvenanceBadgeProps = {
  source: AiLimitSource;
  profileCode?: string | null;
  className?: string;
};

/** Where a resolved number came from. Overrides are highlighted so leftovers stand out. */
export function AiProvenanceBadge({ source, profileCode, className }: AiProvenanceBadgeProps) {
  const label =
    profileCode && source !== 'override' && source !== 'global' && source !== 'plan_allowance'
      ? profileCode
      : SOURCE_LABEL[source];
  return (
    <Badge
      variant={source === 'override' ? 'destructive' : 'secondary'}
      className={cn('max-w-full truncate text-[11px] font-medium', className)}
      title={SOURCE_LABEL[source]}
    >
      {label}
    </Badge>
  );
}
