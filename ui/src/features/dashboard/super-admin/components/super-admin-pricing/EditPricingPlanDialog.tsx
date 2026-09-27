import { useEffect, useState } from 'react';

import {
  DEFAULT_PLAN_FEATURES,
  PLAN_FEATURE_LABELS,
  type PlanFeatures,
} from '@/features/dashboard/plans/lib/planFeatures';
import {
  DEFAULT_VOLUME_DISCOUNT_TIERS,
  DEFAULT_VOLUME_RAMP_AT_COUNT,
  DEFAULT_VOLUME_RAMP_FLOOR_PHP,
  discountedPlanPricePhp,
  normalizeVolumeDiscountTiers,
  type VolumeDiscountTier,
} from '@/features/dashboard/plans/lib/planPricing';
import { VolumePricingEditor } from '@/features/dashboard/super-admin/components/super-admin-pricing/VolumePricingEditor';
import type { PricingPlan } from '@/features/dashboard/super-admin/types/pricingPlan';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';

type EditPricingPlanDialogProps = {
  open: boolean;
  plan: PricingPlan | null;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: {
    name: string;
    tagline: string | null;
    sortOrder: number;
    pricePhp: number | null;
    discountPercent: number;
    volumeDiscountTiers: VolumeDiscountTier[];
    volumeRampFloorPhp: number;
    volumeRampAtCount: number;
    features: PlanFeatures;
    isActive: boolean;
  }) => Promise<boolean>;
  isSaving: boolean;
};

const BOOLEAN_FEATURE_KEYS = [
  'automatedBookingFlow',
  'verifiedBadgeEligible',
  'recommendedBadgeEligible',
  'telegramNotifications',
  'aiValidations',
  'marketingStudio',
  'customPages',
  'aiDashboardAssistant',
  'aiReceptionist',
  'aiMarketingGeneration',
  'aiChatAutoReply',
  'fullyManagedByPlatform',
  'financeReporting',
  'maintenanceReporting',
  'metaChatChannel',
  'quickReplies',
  'customTemplates',
  'publicPagesAutosave',
  'bookingImport',
  'calendarSync',
  'smartPricing',
  'copyPropertySettings',
  'activityLogExport',
] as const satisfies ReadonlyArray<keyof PlanFeatures>;

export function EditPricingPlanDialog({
  open,
  plan,
  onOpenChange,
  onSave,
  isSaving,
}: EditPricingPlanDialogProps) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [pricePhp, setPricePhp] = useState('0');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [volumeRampFloorPhp, setVolumeRampFloorPhp] = useState(DEFAULT_VOLUME_RAMP_FLOOR_PHP);
  const [volumeRampAtCount, setVolumeRampAtCount] = useState(DEFAULT_VOLUME_RAMP_AT_COUNT);
  const [volumeDiscountTiers, setVolumeDiscountTiers] = useState<VolumeDiscountTier[]>([
    ...DEFAULT_VOLUME_DISCOUNT_TIERS,
  ]);
  const [isActive, setIsActive] = useState(true);
  const [features, setFeatures] = useState<PlanFeatures>({ ...DEFAULT_PLAN_FEATURES });

  const resetDraft = () => {
    if (!plan) return;
    setName(plan.name);
    setTagline(plan.tagline ?? '');
    setSortOrder(plan.sortOrder);
    setPricePhp(String(plan.pricePhp ?? 0));
    setDiscountPercent(String(plan.discountPercent ?? 0));
    setVolumeRampFloorPhp(plan.volumeRampFloorPhp ?? DEFAULT_VOLUME_RAMP_FLOOR_PHP);
    setVolumeRampAtCount(plan.volumeRampAtCount ?? DEFAULT_VOLUME_RAMP_AT_COUNT);
    setVolumeDiscountTiers(normalizeVolumeDiscountTiers(plan.volumeDiscountTiers));
    setIsActive(plan.isActive);
    setFeatures({ ...plan.features });
  };

  useEffect(resetDraft, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftKey = JSON.stringify([
    name,
    tagline,
    sortOrder,
    pricePhp,
    discountPercent,
    volumeRampFloorPhp,
    volumeRampAtCount,
    volumeDiscountTiers,
    isActive,
    features,
  ]);
  const baselineKey = plan
    ? JSON.stringify([
        plan.name,
        plan.tagline ?? '',
        plan.sortOrder,
        String(plan.pricePhp ?? 0),
        String(plan.discountPercent ?? 0),
        plan.volumeRampFloorPhp ?? DEFAULT_VOLUME_RAMP_FLOOR_PHP,
        plan.volumeRampAtCount ?? DEFAULT_VOLUME_RAMP_AT_COUNT,
        normalizeVolumeDiscountTiers(plan.volumeDiscountTiers),
        plan.isActive,
        { ...plan.features },
      ])
    : null;
  const isDirty = baselineKey !== null && draftKey !== baselineKey;

  const saveDraft = () =>
    onSave({
      name: name.trim(),
      tagline: tagline.trim() || null,
      sortOrder,
      pricePhp: Number(pricePhp) || 0,
      discountPercent: Math.min(100, Math.max(0, Number(discountPercent) || 0)),
      volumeDiscountTiers: normalizeVolumeDiscountTiers(volumeDiscountTiers),
      volumeRampFloorPhp,
      volumeRampAtCount,
      features,
      isActive,
    });

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: () => (name.trim() ? saveDraft() : Promise.resolve(false)),
    onDiscard: resetDraft,
  });

  if (!plan) return null;

  const listPrice = Number(pricePhp) || 0;
  const discount = Number(discountPercent) || 0;
  const hostPrice = discountedPlanPricePhp(listPrice, discount);

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(90dvh,42rem)] max-w-[min(calc(100vw-1.5rem),32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0"
        >
          <ResponsiveModalHeader className="shrink-0 px-6 pt-6">
            <ResponsiveModalTitle>Edit {plan.code}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan-name">Name</Label>
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-tagline">Tagline</Label>
              <Input
                id="plan-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="plan-sort">Sort order</Label>
                <Input
                  id="plan-sort"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-price">List price (PHP)</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min={0}
                  step={1}
                  value={pricePhp}
                  onChange={(e) => setPricePhp(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-discount">Discount %</Label>
              <Input
                id="plan-discount"
                type="number"
                min={0}
                max={100}
                step={1}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </div>

            <p className="text-muted-foreground text-sm tabular-nums">
              Hosts pay ₱{hostPrice.toLocaleString('en-PH')}/month
              {discount > 0 && hostPrice < listPrice
                ? ` (₱${listPrice.toLocaleString('en-PH')} list, ${Math.floor(discount)}% off)`
                : null}
            </p>

            {!plan.isDefault ? (
              <VolumePricingEditor
                listPricePhp={listPrice}
                discountPercent={discount}
                volumeRampFloorPhp={volumeRampFloorPhp}
                volumeRampAtCount={volumeRampAtCount}
                volumeDiscountTiers={volumeDiscountTiers}
                onVolumeRampFloorPhpChange={setVolumeRampFloorPhp}
                onVolumeRampAtCountChange={setVolumeRampAtCount}
                onVolumeDiscountTiersChange={setVolumeDiscountTiers}
              />
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="plan-ai-credits">AI monthly credits</Label>
              <Input
                id="plan-ai-credits"
                type="number"
                value={features.aiMonthlyCreditAllowance}
                onChange={(e) =>
                  setFeatures((prev) => ({
                    ...prev,
                    aiMonthlyCreditAllowance: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="plan-team-enabled"
                  checked={features.teamManagement.enabled}
                  onCheckedChange={(checked) =>
                    setFeatures((prev) => ({
                      ...prev,
                      teamManagement: {
                        ...prev.teamManagement,
                        enabled: checked === true,
                      },
                    }))
                  }
                />
                <Label htmlFor="plan-team-enabled">{PLAN_FEATURE_LABELS.teamManagement}</Label>
              </div>
              {features.teamManagement.enabled ? (
                <Input
                  aria-label="Max team members"
                  type="number"
                  placeholder="Max members (empty = unlimited)"
                  value={features.teamManagement.maxMembers ?? ''}
                  onChange={(e) =>
                    setFeatures((prev) => ({
                      ...prev,
                      teamManagement: {
                        ...prev.teamManagement,
                        maxMembers: e.target.value === '' ? null : Number(e.target.value) || 0,
                      },
                    }))
                  }
                />
              ) : null}
            </div>

            <div className="grid gap-2">
              {BOOLEAN_FEATURE_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`plan-feature-${key}`}
                    checked={Boolean(features[key])}
                    onCheckedChange={(checked) =>
                      setFeatures((prev) => ({ ...prev, [key]: checked === true }))
                    }
                  />
                  <Label htmlFor={`plan-feature-${key}`}>{PLAN_FEATURE_LABELS[key]}</Label>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="plan-active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <Label htmlFor="plan-active">Active</Label>
            </div>
          </div>

          <ResponsiveModalFooter className="shrink-0 gap-2 px-6 pb-6 pt-3 sm:gap-0">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSaving || !name.trim()}
              onClick={() => void saveDraft()}
            >
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
