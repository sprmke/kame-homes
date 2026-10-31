import type { ReactNode } from 'react';

import { VerificationStatusBadge } from '@/features/dashboard/org/components/verification/VerificationStatusBadge';
import type { VerificationTierDefinition } from '@/features/dashboard/org/lib/orgVerificationTiers';

import { cn } from '@/lib/utils';

type Props = {
  tier: VerificationTierDefinition;
  children: ReactNode;
  className?: string;
  active?: boolean;
};

export function VerificationTierCard({ tier, children, className, active = false }: Props) {
  return (
    <section
      className={cn(
        'bg-card rounded-xl border p-4 sm:p-5',
        active ? 'border-primary/40 shadow-sm' : 'border-border',
        className
      )}
      aria-labelledby={`verification-tier-${tier.id}-title`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id={`verification-tier-${tier.id}-title`}
              className="text-foreground text-sm font-semibold leading-tight"
            >
              {tier.title}
            </h3>
            <VerificationStatusBadge status={tier.status} />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">{tier.benefit}</p>
        </div>
        <span
          className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          aria-hidden
        >
          {tier.level}
        </span>
      </header>
      {children}
    </section>
  );
}
