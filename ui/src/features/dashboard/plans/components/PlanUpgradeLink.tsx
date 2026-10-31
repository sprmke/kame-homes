import type { ReactNode } from 'react';

import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { cn } from '@/lib/utils';

type PlanUpgradeLinkProps = {
  feature: PlanFeatureKey;
  children?: ReactNode;
  className?: string;
};

/** Inline control that opens the subscription upgrade review modal for `feature`. */
export function PlanUpgradeLink({
  feature,
  children = 'Upgrade',
  className,
}: PlanUpgradeLinkProps) {
  const { open } = useUpgradeModal();

  return (
    <button
      type="button"
      onClick={() => open(feature)}
      className={cn(
        'text-primary inline font-semibold underline-offset-2 hover:underline',
        className
      )}
    >
      {children}
    </button>
  );
}

type PlanGatedTextProps = {
  text: string;
  feature: PlanFeatureKey;
  className?: string;
  linkClassName?: string;
};

/**
 * Renders plan-limit copy with inline linked "Upgrade" wherever that word appears.
 */
export function PlanGatedText({ text, feature, className, linkClassName }: PlanGatedTextProps) {
  const parts = text.split(/(\bUpgrade\b)/);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part === 'Upgrade' ? (
          <PlanUpgradeLink key={index} feature={feature} className={linkClassName}>
            Upgrade
          </PlanUpgradeLink>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
}
