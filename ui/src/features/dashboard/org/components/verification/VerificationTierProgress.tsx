import { BadgeCheck, Check, Shield } from 'lucide-react';

import { VerificationStatusBadge } from '@/features/dashboard/org/components/verification/VerificationStatusBadge';
import type { OrgVerificationStatus } from '@/features/dashboard/org/lib/orgVerification';
import {
  type OrgVerificationRejectionKind,
  type VerificationTierDefinition,
} from '@/features/dashboard/org/lib/orgVerificationTiers';

import { cn } from '@/lib/utils';

type Props = {
  tiers: VerificationTierDefinition[];
  activeStep: number;
  onStepChange: (index: number) => void;
  hostRejectionKind?: OrgVerificationRejectionKind | null;
  verifiedRejectionKind?: OrgVerificationRejectionKind | null;
};

function rejectionKindFor(
  tier: VerificationTierDefinition,
  hostKind: OrgVerificationRejectionKind | null | undefined,
  verifiedKind: OrgVerificationRejectionKind | null | undefined
): OrgVerificationRejectionKind | null {
  if (tier.status !== 'rejected') return null;
  return tier.level === 1 ? (hostKind ?? null) : (verifiedKind ?? null);
}

/** Suggested initial step when the modal opens. */
export function defaultVerificationStepIndex(tiers: VerificationTierDefinition[]): number {
  const host = tiers[0];
  const verified = tiers[1];
  if (!host || !verified) return 0;

  if (host.status === 'rejected') return 0;
  if (verified.status === 'rejected') return 1;
  if (verified.status === 'none') return 1;
  if (host.status === 'pending') return 0;
  if (verified.status === 'pending') return 1;
  if (host.status === 'none') return 0;
  return 1;
}

function tierAccentClass(status: OrgVerificationStatus, selected: boolean): string {
  if (status === 'approved') {
    return selected
      ? 'border-emerald-500/50 bg-emerald-500/[0.08] ring-1 ring-emerald-500/25'
      : 'border-emerald-500/30 bg-emerald-500/[0.04]';
  }
  if (status === 'pending') {
    return selected
      ? 'border-amber-500/50 bg-amber-500/[0.08] ring-1 ring-amber-500/25'
      : 'border-amber-500/30 bg-amber-500/[0.04]';
  }
  if (status === 'rejected') {
    return selected
      ? 'border-destructive/50 bg-destructive/[0.06] ring-1 ring-destructive/20'
      : 'border-destructive/30 bg-destructive/[0.04]';
  }
  return selected
    ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/20'
    : 'border-border bg-muted/30 hover:bg-muted/45';
}

function TierLevelBadge({ level, approved }: { level: number; approved: boolean }) {
  return (
    <span
      className={cn(
        'border-border bg-background text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
        approved && 'border-emerald-600 bg-emerald-600 text-white'
      )}
      aria-hidden
    >
      {approved ? <Check className="size-3.5" strokeWidth={2.5} /> : level}
    </span>
  );
}

/** Clickable tier rank cards — tier status is shown once per tab only. */
export function VerificationTierProgress({
  tiers,
  activeStep,
  onStepChange,
  hostRejectionKind = null,
  verifiedRejectionKind = null,
}: Props) {
  return (
    <nav aria-label="Verification tiers" className="w-full">
      <ol className="grid grid-cols-2 gap-2">
        {tiers.map((tier, index) => {
          const kind = rejectionKindFor(tier, hostRejectionKind, verifiedRejectionKind);
          const selected = index === activeStep;
          const isHostTier = tier.level === 1;
          const approved = tier.status === 'approved';

          return (
            <li key={tier.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onStepChange(index)}
                aria-current={selected ? 'step' : undefined}
                className={cn(
                  'flex min-h-[44px] w-full flex-col gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200',
                  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  tierAccentClass(tier.status, selected)
                )}
              >
                <div className="flex w-full min-w-0 items-start gap-2">
                  <TierLevelBadge level={tier.level} approved={approved} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p
                        className={cn(
                          'truncate text-sm font-semibold leading-tight',
                          selected ? 'text-foreground' : 'text-foreground/90'
                        )}
                      >
                        {tier.title}
                      </p>
                      {isHostTier ? (
                        <Shield
                          className={cn(
                            'mt-0.5 size-3.5 shrink-0',
                            approved ? 'text-emerald-600' : 'text-muted-foreground/60'
                          )}
                          aria-hidden
                        />
                      ) : (
                        <BadgeCheck
                          className={cn(
                            'mt-0.5 size-3.5 shrink-0',
                            approved ? 'text-emerald-600' : 'text-primary/70'
                          )}
                          aria-hidden
                        />
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-[11px] leading-none">
                      Tier {tier.level} ·{' '}
                      {tier.requirementLabel ??
                        (isHostTier ? 'Required to host' : 'Optional badge')}
                    </p>
                  </div>
                </div>
                <VerificationStatusBadge
                  status={tier.status}
                  kind={kind}
                  showIcon
                  className="w-fit"
                />
                <span className="sr-only">
                  Tier {tier.level}: {tier.title}
                  {selected ? ', current view' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
