import { useCallback, useEffect, useRef, useState } from 'react';

import { ParkingPricingRatesFormCard } from '@/features/dashboard/parking/components/ParkingPricingRatesFormCard';
import {
  useParkingPricing,
  useSaveParkingPricing,
} from '@/features/dashboard/parking/hooks/useParkingPricing';
import {
  DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE,
  DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE,
  parkingPricingDefaultsFromDto,
} from '@/features/dashboard/parking/lib/parkingPricingDefaults';
import {
  buildParkingPricingSavePatch,
  parkingPricingBaselineFromDto,
  parkingPricingFormHasBaseRateChanges,
  type ParkingPricingFormBaseline,
} from '@/features/dashboard/parking/lib/parkingPricingSave';
import { PricingRatesFormCard } from '@/features/dashboard/pricing/components/PricingRatesFormCard';
import {
  usePropertyPricing,
  useSavePropertyPricing,
} from '@/features/dashboard/pricing/hooks/usePropertyPricing';
import { propertyPricingDefaultsFromDto } from '@/features/dashboard/pricing/lib/pricingCompute';
import {
  DEFAULT_WEEKDAY_NIGHTLY_RATE,
  DEFAULT_WEEKEND_NIGHTLY_RATE,
  feesFromPricingDefaults,
  type PropertyFeeConfig,
  type PropertyFeeId,
} from '@/features/dashboard/pricing/lib/pricingDefaults';
import {
  buildFeesOnlySavePatch,
  buildPricingSavePatch,
  pricingBaselineFromDefaults,
  pricingFormHasBaseRateChanges,
  pricingFormHasFeeChanges,
  type PricingFormBaseline,
} from '@/features/dashboard/pricing/lib/pricingSave';
import { useSetupGuide } from '@/features/dashboard/setup-guide/components/setupGuideContext';
import { useRegisterStepSave } from '@/features/dashboard/setup-guide/components/SetupGuideSaveContext';
import { SetupGuideStepSkeleton } from '@/features/dashboard/setup-guide/components/SetupGuideStepSkeleton';
import { useSetupGuideStateWrite } from '@/features/dashboard/setup-guide/hooks/useSetupGuideStateWrite';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasOrgPermission } from '@/features/dashboard/team/lib/orgPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

function markPricingReviewed(
  write: ReturnType<typeof useSetupGuideStateWrite>,
  persisted: ReturnType<typeof useSetupGuide>['persisted'],
  stepId: string
) {
  const reviewed = new Set(persisted.reviewedSteps);
  reviewed.add(stepId);
  return write.setReviewedSteps([...reviewed]);
}

export function SetupGuidePropertyPricingEmbed({ propertyId }: { propertyId: string }) {
  const { org, persisted } = useSetupGuide();
  const write = useSetupGuideStateWrite(org?.id);
  const stepId = `property.${propertyId}.pricing`;
  const { data: access } = usePropertyPermissions();
  const canEdit = hasPropertyPermission(access?.permissions, 'pricing.rates:edit');

  const [currentMonth] = useState(() => new Date());
  const { data: pricingData, isLoading, isError, error } = usePropertyPricing(currentMonth);
  const saveMutation = useSavePropertyPricing();

  const [weekdayRate, setWeekdayRate] = useState(DEFAULT_WEEKDAY_NIGHTLY_RATE);
  const [weekendRate, setWeekendRate] = useState(DEFAULT_WEEKEND_NIGHTLY_RATE);
  const [fees, setFees] = useState<PropertyFeeConfig[]>(() =>
    feesFromPricingDefaults({
      weekdayNightlyRate: DEFAULT_WEEKDAY_NIGHTLY_RATE,
      weekendNightlyRate: DEFAULT_WEEKEND_NIGHTLY_RATE,
      downPayment: 0,
      securityDeposit: 0,
      petFee: 0,
      parkingRateGuest: 0,
      guestAdditionalFee: 0,
    })
  );
  const [customDatePrices, setCustomDatePrices] = useState<Map<string, number>>(() => new Map());
  const [bookedDateKeys, setBookedDateKeys] = useState<Set<string>>(() => new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const hydratedRef = useRef(false);
  const baselineRef = useRef<PricingFormBaseline | null>(null);

  useEffect(() => {
    if (!pricingData) return;

    setBookedDateKeys(new Set(pricingData.bookedDateKeys));
    if (hasChanges || hydratedRef.current) return;

    const defaults = propertyPricingDefaultsFromDto(pricingData);
    setWeekdayRate(defaults.weekdayNightlyRate);
    setWeekendRate(defaults.weekendNightlyRate);
    setFees(feesFromPricingDefaults(defaults));
    setCustomDatePrices(new Map(Object.entries(pricingData.dateOverrides)));
    baselineRef.current = pricingBaselineFromDefaults(defaults);
    hydratedRef.current = true;
  }, [pricingData, hasChanges]);

  const updateFeeAmount = (feeId: PropertyFeeId, amount: number) => {
    setFees((prev) => prev.map((fee) => (fee.id === feeId ? { ...fee, amount } : fee)));
    setHasChanges(true);
  };

  const save = useCallback(async () => {
    const baseline = baselineRef.current;
    const dirty =
      hasChanges &&
      baseline &&
      (pricingFormHasBaseRateChanges(baseline, weekdayRate, weekendRate) ||
        pricingFormHasFeeChanges(baseline, fees));

    if (!dirty) {
      await markPricingReviewed(write, persisted, stepId);
      return true;
    }

    try {
      if (baseline && pricingFormHasBaseRateChanges(baseline, weekdayRate, weekendRate)) {
        const patch = buildPricingSavePatch(
          {
            weekdayRate,
            weekendRate,
            fees,
            customDatePrices,
            currentMonth,
            holidayRuleDtos: pricingData?.holidayRules,
            bookedDateKeys,
          },
          { overrideCustomRates: false, baseRateScope: 'all_future' }
        );
        const data = await saveMutation.mutateAsync(patch);
        setHasChanges(false);
        setCustomDatePrices(new Map(Object.entries(data.dateOverrides)));
        const defaults = propertyPricingDefaultsFromDto(data);
        baselineRef.current = pricingBaselineFromDefaults(defaults);
        setWeekdayRate(defaults.weekdayNightlyRate);
        setWeekendRate(defaults.weekendNightlyRate);
        setFees(feesFromPricingDefaults(defaults));
      } else if (baseline && pricingFormHasFeeChanges(baseline, fees)) {
        const data = await saveMutation.mutateAsync(buildFeesOnlySavePatch(fees));
        setHasChanges(false);
        const defaults = propertyPricingDefaultsFromDto(data);
        baselineRef.current = pricingBaselineFromDefaults(defaults);
        setFees(feesFromPricingDefaults(defaults));
      }
      await markPricingReviewed(write, persisted, stepId);
      return true;
    } catch {
      return false;
    }
  }, [
    bookedDateKeys,
    currentMonth,
    customDatePrices,
    fees,
    hasChanges,
    persisted,
    pricingData?.holidayRules,
    saveMutation,
    stepId,
    weekdayRate,
    weekendRate,
    write,
  ]);

  useRegisterStepSave(save);

  if (isLoading && !hydratedRef.current) {
    return <SetupGuideStepSkeleton kind="property.pricing" />;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        {(error as Error)?.message ?? 'Could not load pricing'}
      </p>
    );
  }

  return (
    <PricingRatesFormCard
      weekdayRate={weekdayRate}
      weekendRate={weekendRate}
      fees={fees}
      readOnly={!canEdit}
      hasChanges={hasChanges}
      saving={saveMutation.isPending}
      embedded
      onWeekdayChange={(value) => {
        setWeekdayRate(value);
        setHasChanges(true);
      }}
      onWeekendChange={(value) => {
        setWeekendRate(value);
        setHasChanges(true);
      }}
      onAmountChange={updateFeeAmount}
      onSaveClick={() => void save()}
    />
  );
}

export function SetupGuideParkingPricingEmbed({ parkingId }: { parkingId: string }) {
  const { org, persisted } = useSetupGuide();
  const write = useSetupGuideStateWrite(org?.id);
  const stepId = `parking.${parkingId}.pricing`;
  const { data: orgAccess } = useOrgPermissions();
  const canEdit = hasOrgPermission(orgAccess?.permissions, 'org:parkings:manage');

  const [currentMonth] = useState(() => new Date());
  const { data: pricingData, isLoading, isError, error } = useParkingPricing(currentMonth);
  const saveMutation = useSaveParkingPricing();

  const [weekdayRate, setWeekdayRate] = useState(DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE);
  const [weekendRate, setWeekendRate] = useState(DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE);
  const [customDatePrices, setCustomDatePrices] = useState<Map<string, number>>(() => new Map());
  const [bookedDateKeys, setBookedDateKeys] = useState<Set<string>>(() => new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const hydratedRef = useRef(false);
  const baselineRef = useRef<ParkingPricingFormBaseline | null>(null);

  useEffect(() => {
    if (!pricingData) return;

    setBookedDateKeys(new Set(pricingData.bookedDateKeys));
    if (hasChanges || hydratedRef.current) return;

    const defaults = parkingPricingDefaultsFromDto(pricingData);
    setWeekdayRate(defaults.weekdayNightlyRate);
    setWeekendRate(defaults.weekendNightlyRate);
    setCustomDatePrices(new Map(Object.entries(pricingData.dateOverrides)));
    baselineRef.current = parkingPricingBaselineFromDto(pricingData);
    hydratedRef.current = true;
  }, [pricingData, hasChanges]);

  const save = useCallback(async () => {
    const baseline = baselineRef.current;
    const dirty =
      hasChanges &&
      baseline &&
      parkingPricingFormHasBaseRateChanges(baseline, weekdayRate, weekendRate);

    if (!dirty) {
      await markPricingReviewed(write, persisted, stepId);
      return true;
    }

    try {
      const patch = buildParkingPricingSavePatch(
        {
          weekdayRate,
          weekendRate,
          customDatePrices,
          currentMonth,
          bookedDateKeys,
        },
        { overrideCustomRates: false, baseRateScope: 'all_future' }
      );
      const data = await saveMutation.mutateAsync(patch);
      setHasChanges(false);
      setCustomDatePrices(new Map(Object.entries(data.dateOverrides)));
      baselineRef.current = parkingPricingBaselineFromDto(data);
      const defaults = parkingPricingDefaultsFromDto(data);
      setWeekdayRate(defaults.weekdayNightlyRate);
      setWeekendRate(defaults.weekendNightlyRate);
      await markPricingReviewed(write, persisted, stepId);
      return true;
    } catch {
      return false;
    }
  }, [
    bookedDateKeys,
    currentMonth,
    customDatePrices,
    hasChanges,
    persisted,
    saveMutation,
    stepId,
    weekdayRate,
    weekendRate,
    write,
  ]);

  useRegisterStepSave(save);

  if (isLoading && !hydratedRef.current) {
    return <SetupGuideStepSkeleton kind="parking.pricing" />;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        {(error as Error)?.message ?? 'Could not load pricing'}
      </p>
    );
  }

  return (
    <ParkingPricingRatesFormCard
      weekdayRate={weekdayRate}
      weekendRate={weekendRate}
      guestRateCapWeekday={pricingData?.guestRateCapWeekday}
      guestRateCapWeekend={pricingData?.guestRateCapWeekend}
      commissionPct={pricingData?.commissionPct}
      readOnly={!canEdit}
      hasChanges={hasChanges}
      saving={saveMutation.isPending}
      embedded
      onWeekdayChange={(value) => {
        setWeekdayRate(value);
        setHasChanges(true);
      }}
      onWeekendChange={(value) => {
        setWeekendRate(value);
        setHasChanges(true);
      }}
      onSaveClick={() => void save()}
    />
  );
}
