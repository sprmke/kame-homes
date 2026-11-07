import { AlertTriangle, BadgeCheck, HelpCircle, ShieldX } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import {
  identityVerdictDetail,
  identityVerdictLabel,
  sortIdentityFlags,
  type IdentityFlag,
  type IdentityVerdict,
} from '../lib/identityVerdict';

type VerificationResultBadgeProps = {
  verdict: IdentityVerdict;
  flags?: readonly IdentityFlag[];
  className?: string;
  /** Hide the tooltip when the badge sits inside a link or a button. */
  withTooltip?: boolean;
};

const ICONS: Record<IdentityVerdict, typeof BadgeCheck> = {
  verified: BadgeCheck,
  partially_verified: HelpCircle,
  unverified: AlertTriangle,
  rejected: ShieldX,
  expired: AlertTriangle,
};

const VARIANTS: Record<IdentityVerdict, 'success' | 'secondary' | 'outline' | 'destructive'> = {
  verified: 'success',
  partially_verified: 'secondary',
  unverified: 'outline',
  rejected: 'destructive',
  expired: 'outline',
};

/**
 * One badge for every surface: booking guest rows, host verification, super-admin review.
 * The tooltip states what the check actually proved, so a `partially_verified` badge never
 * reads as a certified biometric match.
 */
export function VerificationResultBadge({
  verdict,
  flags = [],
  className,
  withTooltip = true,
}: VerificationResultBadgeProps) {
  const Icon = ICONS[verdict];
  const blocking = sortIdentityFlags(flags).filter((flag) => flag.severity === 'blocking');

  const badge = (
    <Badge variant={VARIANTS[verdict]} className={cn('gap-1 whitespace-nowrap', className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {identityVerdictLabel(verdict)}
    </Badge>
  );

  if (!withTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-full">
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{identityVerdictDetail(verdict)}</p>
        {blocking.length > 0 && (
          <p className="text-muted-foreground mt-1">
            {blocking.map((flag) => flag.code.replace(/_/g, ' ')).join(', ')}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
