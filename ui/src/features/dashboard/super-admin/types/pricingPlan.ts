import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';
import type { VolumeDiscountTier } from '@/features/dashboard/plans/lib/planPricing';

export type PricingPlan = {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  sortOrder: number;
  pricingModel: 'subscription' | 'commission';
  pricePhp: number | null;
  discountPercent: number;
  /** Applied to (per-property rate x enrolled count) on top of discountPercent's flat promo. */
  volumeDiscountTiers: VolumeDiscountTier[];
  /** Per-property floor at volumeRampAtCount during the 1…N linear ramp. */
  volumeRampFloorPhp: number;
  /** Property count where the ramp reaches volumeRampFloorPhp. */
  volumeRampAtCount: number;
  billingInterval: string;
  commissionRatePercent: number | null;
  features: PlanFeatures;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrgSubscriptionSummary = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  propertyCount: number;
  subscription: {
    id: string;
    planId: string;
    planCode: string | null;
    planName: string | null;
    pricingModel: string;
    status: string;
    pricePhpSnapshot: number | null;
    updatedAt: string;
  } | null;
};
