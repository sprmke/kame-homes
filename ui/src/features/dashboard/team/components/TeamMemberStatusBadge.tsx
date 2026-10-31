import { Sparkles } from 'lucide-react';

import type { TeamMemberStatus } from '@/features/dashboard/team/types/propertyTeam';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { semanticBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

type Props = {
  status: TeamMemberStatus;
  planLimited?: boolean;
};

/**
 * Status chrome for member rows. Active / manually disabled use row opacity only.
 * Plan-limited inactive still shows a badge (reason is not obvious from muted chrome alone).
 */
export function TeamMemberStatusBadge({ status, planLimited = false }: Props) {
  if (status === 'inactive' && planLimited) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('border-transparent', semanticBadgeClasses('warning'))}
          >
            <Sparkles className="mr-1 size-3" aria-hidden />
            Plan limit
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Paused when the plan seat limit was reached. Upgrade or free a seat to restore access.
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
