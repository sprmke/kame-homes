import type { ReactNode } from 'react';

import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { cn } from '@/lib/utils';

type FeatureGateMode = 'hide' | 'disable' | 'watermark' | 'badge-only';

type Props = {
  feature: PlanFeatureKey;
  mode?: FeatureGateMode;
  children: ReactNode;
  className?: string;
  onBlockedClick?: () => void;
};

export function FeatureGate({
  feature,
  mode = 'hide',
  children,
  className,
  onBlockedClick,
}: Props) {
  const { allowed, isLoading } = useFeatureGate(feature);
  const { open } = useUpgradeModal();

  if (isLoading) return null;

  if (allowed) {
    return <>{children}</>;
  }

  if (mode === 'hide') {
    return null;
  }

  if (mode === 'badge-only') {
    return <span className={className}>{children}</span>;
  }

  if (mode === 'watermark') {
    return (
      <div className={cn('relative', className)}>
        {children}
        <button
          type="button"
          className="bg-background/10 pointer-events-auto absolute inset-0 z-10 flex items-center justify-center"
          aria-label="Upgrade to remove preview watermark"
          onClick={() => {
            onBlockedClick?.();
            open(feature);
          }}
        >
          <span
            className="text-muted-foreground/40 pointer-events-none select-none text-4xl font-bold uppercase tracking-widest sm:text-5xl"
            aria-hidden
          >
            Preview
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn('pointer-events-none opacity-50', className)}
      aria-disabled
      onClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onBlockedClick?.();
        open(feature);
      }}
    >
      {children}
    </div>
  );
}
