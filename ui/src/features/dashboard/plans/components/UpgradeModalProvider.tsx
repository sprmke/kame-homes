import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { SubscriptionUpgradeModal } from '@/features/dashboard/plans/components/SubscriptionUpgradeModal';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import { registerUpgradeModalOpener } from '@/features/dashboard/plans/lib/upgradeModalBridge';

import { captureAppEvent } from '@/lib/posthog/capture';

type UpgradeModalContextValue = {
  open: (feature: PlanFeatureKey) => void;
};

const UpgradeModalContext = createContext<UpgradeModalContextValue | null>(null);

export function useUpgradeModal(): UpgradeModalContextValue {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) {
    return { open: () => {} };
  }
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
};

/** Opens the inline upgrade review modal; org Plans checkout only after **Continue to payment**. */
export function UpgradeModalProvider({ children }: ProviderProps) {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<PlanFeatureKey | null>(null);

  const openModal = useCallback((nextFeature: PlanFeatureKey) => {
    setFeature(nextFeature);
    setOpen(true);
    captureAppEvent('upgrade_modal_shown', { feature_key: nextFeature });
  }, []);

  useEffect(() => {
    registerUpgradeModalOpener(openModal);
    return () => registerUpgradeModalOpener(null);
  }, [openModal]);

  const value = useMemo(() => ({ open: openModal }), [openModal]);

  return (
    <UpgradeModalContext.Provider value={value}>
      {children}
      <SubscriptionUpgradeModal
        open={open}
        feature={feature}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setFeature(null);
        }}
      />
    </UpgradeModalContext.Provider>
  );
}
