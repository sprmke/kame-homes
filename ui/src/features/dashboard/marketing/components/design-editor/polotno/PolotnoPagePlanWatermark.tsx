import { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

import { PlanGateWatermarkPattern } from '@/features/dashboard/plans/components/PlanGateWatermarkPattern';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

type Props = {
  /** Root that contains OpenPolotno (e.g. `.polotno-studio-root` / `.kame-polotno-shell`). */
  rootRef: React.RefObject<HTMLElement | null>;
  feature?: PlanFeatureKey;
};

function findPolotnoPageEl(root: HTMLElement): HTMLElement | null {
  return (
    (root.querySelector('.raeditor-page-container.active-page') as HTMLElement | null) ??
    (root.querySelector('.raeditor-page-container') as HTMLElement | null)
  );
}

/**
 * Tiles the plan watermark over the active Polotno page only (orientation size), not the
 * letterboxed workspace / toolbar / side panel.
 */
export function PolotnoPagePlanWatermark({ rootRef, feature = 'marketingStudio' }: Props) {
  const { allowed, isLoading } = useFeatureGate(feature);
  const { open } = useUpgradeModal();
  const [pageEl, setPageEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isLoading && allowed) {
      setPageEl(null);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const sync = () => {
      const next = findPolotnoPageEl(root);
      setPageEl((current) => (current === next ? current : next));
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    return () => observer.disconnect();
  }, [allowed, isLoading, rootRef]);

  if (!isLoading && allowed) return null;
  if (!pageEl) return null;

  if (getComputedStyle(pageEl).position === 'static') {
    pageEl.style.position = 'relative';
  }

  return createPortal(
    <button
      type="button"
      className="pointer-events-auto absolute inset-0 z-[60] overflow-hidden rounded-[inherit] bg-transparent"
      aria-label="Upgrade to remove preview watermark"
      onClick={(event) => {
        event.stopPropagation();
        open(feature);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <PlanGateWatermarkPattern />
    </button>,
    pageEl
  );
}
