import type { ReactNode } from 'react';

import { PlanGateWatermarkPattern } from '@/features/dashboard/plans/components/PlanGateWatermarkPattern';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { cn } from '@/lib/utils';

type Props = {
  feature?: PlanFeatureKey;
  children: ReactNode;
  className?: string;
  /**
   * `fill` — overlay stretches to the wrapper (default).
   * `content` — wrapper shrink-wraps children so the watermark matches the canvas/frame size.
   */
  fit?: 'fill' | 'content';
};

/** Non-configurable plan-tier watermark over Marketing Studio previews — tiled, stock-photo style. */
export function PlanGateWatermarkOverlay({
  feature = 'marketingStudio',
  children,
  className,
  fit = 'fill',
}: Props) {
  const { allowed, isLoading } = useFeatureGate(feature);
  const { open } = useUpgradeModal();

  // Default to watermarked while entitlements are still loading — never briefly reveal a
  // watermark-free preview to a not-yet-confirmed-entitled property.
  if (!isLoading && allowed) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        'relative',
        fit === 'content' && 'inline-flex max-h-full max-w-full',
        className
      )}
    >
      {children}
      <button
        type="button"
        className="pointer-events-auto absolute inset-0 z-20 overflow-hidden rounded-[inherit] bg-transparent"
        aria-label="Upgrade to remove preview watermark"
        onClick={() => open(feature)}
        onContextMenu={(event) => event.preventDefault()}
      >
        <PlanGateWatermarkPattern />
      </button>
    </div>
  );
}
