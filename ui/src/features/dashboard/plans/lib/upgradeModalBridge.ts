import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

type UpgradeModalOpener = (feature: PlanFeatureKey) => void;

let registeredOpener: UpgradeModalOpener | null = null;

export function registerUpgradeModalOpener(opener: UpgradeModalOpener | null): void {
  registeredOpener = opener;
}

export function openUpgradeModalFromBridge(feature: PlanFeatureKey): void {
  registeredOpener?.(feature);
}

export function hasUpgradeModalOpener(): boolean {
  return registeredOpener !== null;
}
