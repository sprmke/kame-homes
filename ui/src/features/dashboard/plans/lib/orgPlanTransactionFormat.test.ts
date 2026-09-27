import { describe, expect, it } from 'vitest';

import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';
import {
  paymentMethodLabel,
  transactionStatusMeta,
  transactionTitle,
} from '@/features/dashboard/plans/lib/orgPlanTransactionFormat';

const GROWTH_PLAN: OrgBundlePlanDto = {
  id: 'plan-growth',
  code: 'growth',
  name: 'Pro',
  tagline: null,
  sortOrder: 2,
  pricingModel: 'subscription',
  pricePhp: 799,
  discountPercent: 20,
  volumeDiscountTiers: [],
  volumeRampFloorPhp: 500,
  volumeRampAtCount: 10,
  features: {} as PlanFeatures,
  isDefault: false,
};

describe('orgPlanTransactionFormat', () => {
  it('maps known payment statuses', () => {
    expect(transactionStatusMeta('paid')).toEqual({ label: 'Paid', tone: 'success' });
    expect(transactionStatusMeta('pending')).toEqual({ label: 'Pending', tone: 'secondary' });
    expect(transactionStatusMeta('failed')).toEqual({ label: 'Failed', tone: 'destructive' });
  });

  it('falls back for unknown statuses', () => {
    expect(transactionStatusMeta('refunded')).toEqual({ label: 'refunded', tone: 'secondary' });
  });

  it('formats payment method labels', () => {
    expect(paymentMethodLabel('qrph')).toBe('QRPH');
    expect(paymentMethodLabel('gcash')).toBe('GCash');
    expect(paymentMethodLabel(null)).toBeNull();
  });

  it('resolves transaction titles from plan catalog', () => {
    expect(transactionTitle('plan-growth', [GROWTH_PLAN])).toBe('Pro plan');
    expect(transactionTitle('missing', [GROWTH_PLAN])).toBe('Subscription payment');
  });
});
