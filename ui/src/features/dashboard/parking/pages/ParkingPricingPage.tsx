import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { format, eachDayOfInterval, isSameDay, isBefore, startOfToday } from 'date-fns';

import { ParkingDirectLinkCard } from '@/features/dashboard/parking/components/ParkingDirectLinkCard';
import { ParkingPricingRatesFormCard } from '@/features/dashboard/parking/components/ParkingPricingRatesFormCard';
import { ParkingPricingStatsRow } from '@/features/dashboard/parking/components/ParkingPricingStatsRow';
import {
  useParkingPricing,
  useSaveParkingPricing,
} from '@/features/dashboard/parking/hooks/useParkingPricing';
import { resolveParkingNightlyRateForDate } from '@/features/dashboard/parking/lib/parkingPricingCompute';
import {
  DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE,
  DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE,
  parkingPricingDefaultsFromDto,
} from '@/features/dashboard/parking/lib/parkingPricingDefaults';
import {
  buildParkingPricingSavePatch,
  dateOverridesRecordFromMap,
  parkingPricingBaselineFromDto,
  parkingPricingFormHasBaseRateChanges,
  type ParkingPricingFormBaseline,
  type ParkingPricingSaveOptions,
} from '@/features/dashboard/parking/lib/parkingPricingSave';
import { PricingCalendarGrid } from '@/features/dashboard/pricing/components/PricingCalendarGrid';
import { PricingDateModal } from '@/features/dashboard/pricing/components/PricingDateModal';
import { PricingSaveDialog } from '@/features/dashboard/pricing/components/PricingSaveDialog';
import {
  contiguousDateRanges,
  dateKey,
} from '@/features/dashboard/pricing/lib/pricingCalendarUtils';
import { mergeDateRateOverrides } from '@/features/dashboard/pricing/lib/pricingCalendarUtils';
import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import { pricingCalendarFormGridClassName } from '@/features/dashboard/pricing/lib/pricingCalendarLayout';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { hasOrgPermission } from '@/features/dashboard/team/lib/orgPermissions';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { PricingPageBodySkeleton } from '@/components/skeletons/PricingSkeleton';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

export function ParkingPricingPage() {
  const compactChrome = useDashboardCompactChrome();
  const { data: orgAccess } = useOrgPermissions();
  const canEdit = hasOrgPermission(orgAccess?.permissions, 'org:parkings:manage');

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const { data: pricingData, isLoading, isError, error } = useParkingPricing(currentMonth);
  const saveMutation = useSaveParkingPricing();

  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const justSelectedRef = useRef(false);
  const selectedDatesRef = useRef(selectedDates);
  selectedDatesRef.current = selectedDates;

  const [weekdayRate, setWeekdayRate] = useState(DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE);
  const [weekendRate, setWeekendRate] = useState(DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE);
  const [bookedDateKeys, setBookedDateKeys] = useState<Set<string>>(() => new Set());
  const [blockedDateKeys, setBlockedDateKeys] = useState<Set<string>>(() => new Set());
  const [customDatePrices, setCustomDatePrices] = useState<Map<string, number>>(() => new Map());

  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const hydratedRef = useRef(false);
  const baselineRef = useRef<ParkingPricingFormBaseline | null>(null);

  const syncBaselineFromDto = useCallback((data: NonNullable<typeof pricingData>) => {
    baselineRef.current = parkingPricingBaselineFromDto(data);
  }, []);

  useEffect(() => {
    if (!pricingData) return;

    setBookedDateKeys(new Set(pricingData.bookedDateKeys));
    setBlockedDateKeys(new Set(pricingData.blockedDateKeys ?? []));

    if (hasChanges || hydratedRef.current) return;

    const defaults = parkingPricingDefaultsFromDto(pricingData);
    setWeekdayRate(defaults.weekdayNightlyRate);
    setWeekendRate(defaults.weekendNightlyRate);
    setCustomDatePrices(new Map(Object.entries(pricingData.dateOverrides)));
    syncBaselineFromDto(pricingData);
    hydratedRef.current = true;
  }, [pricingData, hasChanges, syncBaselineFromDto]);

  const getPriceForDate = useCallback(
    (date: Date) => {
      const key = dateKey(date);
      const isBooked = bookedDateKeys.has(key);
      const isBlocked = blockedDateKeys.has(key);
      const customPrice = customDatePrices.get(key);
      // Parking has no OTA calendar sync — imported blocks never apply here.
      if (customPrice !== undefined) {
        return {
          price: customPrice,
          isCustom: true as const,
          isBooked,
          isBlocked,
          isImported: false,
        };
      }

      const price = resolveParkingNightlyRateForDate(date, {
        weekdayNightlyRate: weekdayRate,
        weekendNightlyRate: weekendRate,
      });

      return { price, isCustom: false as const, isBooked, isBlocked, isImported: false };
    },
    [bookedDateKeys, blockedDateKeys, customDatePrices, weekdayRate, weekendRate]
  );

  const selectionMode = useMemo<'available' | 'blocked'>(() => {
    const first = selectedDates[0];
    return first && blockedDateKeys.has(dateKey(first)) ? 'blocked' : 'available';
  }, [selectedDates, blockedDateKeys]);

  const openDateModal = useCallback(
    (dates: Date[]) => {
      if (dates.length === 0) {
        setDateModalOpen(false);
        setNewPrice('');
        return;
      }
      const first = [...dates].sort((a, b) => a.getTime() - b.getTime())[0];
      if (first) {
        setNewPrice(String(getPriceForDate(first).price));
      }
      setDateModalOpen(true);
    },
    [getPriceForDate]
  );

  const handleDateClick = (date: Date) => {
    if (isBefore(date, startOfToday()) || !canEdit || bookedDateKeys.has(dateKey(date))) {
      return;
    }
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    const clickedIsBlocked = blockedDateKeys.has(dateKey(date));
    const firstSelected = selectedDates[0];
    const kindMismatch =
      firstSelected != null && blockedDateKeys.has(dateKey(firstSelected)) !== clickedIsBlocked;

    let next: Date[];
    if (kindMismatch) {
      next = [date];
    } else if (selectedDates.some((d) => isSameDay(d, date))) {
      next = selectedDates.filter((d) => !isSameDay(d, date));
    } else {
      next = [...selectedDates, date];
    }
    setSelectedDates(next);
    openDateModal(next);
  };

  const handleDateMouseDown = (date: Date) => {
    if (isBefore(date, startOfToday()) || !canEdit || bookedDateKeys.has(dateKey(date))) {
      return;
    }
    setIsSelecting(true);
    justSelectedRef.current = true;
    const next = [date];
    setSelectedDates(next);
  };

  const handleDateMouseEnter = (date: Date) => {
    if (
      !isSelecting ||
      isBefore(date, startOfToday()) ||
      !canEdit ||
      bookedDateKeys.has(dateKey(date))
    ) {
      return;
    }
    const firstDate = selectedDates[0];
    if (!firstDate) return;

    const start = firstDate < date ? firstDate : date;
    const end = firstDate < date ? date : firstDate;
    const range = eachDayOfInterval({ start, end }).filter((d) => !isBefore(d, startOfToday()));
    setSelectedDates(range);
  };

  const handleSelectionEnd = () => {
    if (!isSelecting) return;
    setIsSelecting(false);
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 100);
    if (selectedDatesRef.current.length > 0) {
      openDateModal(selectedDatesRef.current);
    }
  };

  const clearSelection = () => {
    setSelectedDates([]);
    setNewPrice('');
    setDateModalOpen(false);
  };

  const persistDateOverrides = (next: Map<string, number>, onSuccess?: () => void) => {
    saveMutation.mutate(
      { dateOverrides: dateOverridesRecordFromMap(next) },
      {
        onSuccess: (data) => {
          setCustomDatePrices(new Map(Object.entries(data.dateOverrides)));
          onSuccess?.();
        },
      }
    );
  };

  const applyCustomPrice = () => {
    if (!newPrice.trim() || selectedDates.length === 0) return;
    const price = parseFloat(newPrice);
    if (!Number.isFinite(price) || price < 0) return;

    const defaults = {
      weekdayNightlyRate: weekdayRate,
      weekendNightlyRate: weekendRate,
    };
    const next = mergeDateRateOverrides(customDatePrices, selectedDates, price, (date) =>
      resolveParkingNightlyRateForDate(date, defaults)
    );
    persistDateOverrides(next, clearSelection);
  };

  const resetSelectedToDefault = () => {
    const next = new Map(customDatePrices);
    selectedDates.forEach((date) => {
      next.delete(format(date, 'yyyy-MM-dd'));
    });
    persistDateOverrides(next, clearSelection);
  };

  const blockSelectedDates = async () => {
    if (selectedDates.length === 0) return;
    const today = startOfToday();
    const eligible = selectedDates.filter(
      (date) => !isBefore(date, today) && !bookedDateKeys.has(dateKey(date))
    );
    if (eligible.length === 0) return;

    let lastData: NonNullable<typeof pricingData> | undefined;
    for (const range of contiguousDateRanges(eligible)) {
      lastData = await saveMutation.mutateAsync({ blockRange: range });
    }
    if (lastData) setBlockedDateKeys(new Set(lastData.blockedDateKeys));
    clearSelection();
  };

  const unblockSelectedDates = () => {
    if (selectedDates.length === 0) return;
    saveMutation.mutate(
      { unblockDateKeys: selectedDates.map((date) => dateKey(date)) },
      {
        onSuccess: (data) => {
          setBlockedDateKeys(new Set(data.blockedDateKeys));
          clearSelection();
        },
      }
    );
  };

  const savePricing = async (options: ParkingPricingSaveOptions): Promise<boolean> => {
    const patch = buildParkingPricingSavePatch(
      {
        weekdayRate,
        weekendRate,
        customDatePrices,
        currentMonth,
        bookedDateKeys,
      },
      options
    );

    try {
      const data = await saveMutation.mutateAsync(patch);
      setHasChanges(false);
      setSaveDialogOpen(false);
      setCustomDatePrices(new Map(Object.entries(data.dateOverrides)));
      syncBaselineFromDto(data);
      if (options.baseRateScope === 'all_future') {
        const defaults = parkingPricingDefaultsFromDto(data);
        setWeekdayRate(defaults.weekdayNightlyRate);
        setWeekendRate(defaults.weekendNightlyRate);
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleSaveConfirm = (options: ParkingPricingSaveOptions) => {
    void savePricing(options);
  };

  const handleSaveClick = () => {
    const baseline = baselineRef.current;
    if (!baseline) return;

    if (parkingPricingFormHasBaseRateChanges(baseline, weekdayRate, weekendRate)) {
      setSaveDialogOpen(true);
    }
  };

  const suggestedPrice = useMemo(() => {
    if (selectedDates.length === 0) return weekdayRate;
    const first = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())[0];
    if (!first) return weekdayRate;
    return resolveParkingNightlyRateForDate(first, {
      weekdayNightlyRate: weekdayRate,
      weekendNightlyRate: weekendRate,
    });
  }, [selectedDates, weekdayRate, weekendRate]);

  const ratesDirty =
    hasChanges &&
    baselineRef.current != null &&
    parkingPricingFormHasBaseRateChanges(baselineRef.current, weekdayRate, weekendRate);

  useUnsavedChangesGuard({
    isDirty: ratesDirty,
    enabled: canEdit,
    onSave: () => savePricing({ overrideCustomRates: false, baseRateScope: 'all_future' }),
  });

  if (isLoading && !hydratedRef.current) {
    return (
      <AdminMobilePage
        title="Pricing"
        subtitle="Manage pricing and availability."
        titleId="parking-pricing-heading"
      >
        <PricingPageBodySkeleton />
      </AdminMobilePage>
    );
  }

  if (isError) {
    return (
      <AdminMobilePage
        title="Pricing"
        subtitle="Manage pricing and availability."
        titleId="parking-pricing-heading"
      >
        <FloatingPanel
          padding="lg"
          className="border-destructive/30 bg-destructive/5 text-destructive text-sm"
        >
          {(error as Error)?.message ?? 'Failed to load pricing'}
        </FloatingPanel>
      </AdminMobilePage>
    );
  }

  return (
    <>
      <AdminMobilePage
        title="Pricing"
        subtitle="Manage pricing and availability."
        titleId="parking-pricing-heading"
      >
        <ParkingPricingStatsRow
          weekdayRate={weekdayRate}
          weekendRate={weekendRate}
          customDatesCount={customDatePrices.size}
        />

        <div className={pricingCalendarFormGridClassName(compactChrome)}>
          <PricingCalendarGrid
            currentMonth={currentMonth}
            selectedDates={selectedDates}
            bookings={[]}
            onMonthChange={setCurrentMonth}
            onDateClick={handleDateClick}
            onDateMouseDown={handleDateMouseDown}
            onDateMouseEnter={handleDateMouseEnter}
            onSelectionEnd={handleSelectionEnd}
            onBookingClick={() => {}}
            getPriceForDate={getPriceForDate}
          />

          <div className="space-y-3 lg:sticky lg:top-5">
            <ParkingPricingRatesFormCard
              weekdayRate={weekdayRate}
              weekendRate={weekendRate}
              guestRateCapWeekday={pricingData?.guestRateCapWeekday}
              guestRateCapWeekend={pricingData?.guestRateCapWeekend}
              commissionPct={pricingData?.commissionPct}
              readOnly={!canEdit}
              hasChanges={hasChanges}
              saving={saveMutation.isPending}
              onWeekdayChange={(value) => {
                setWeekdayRate(value);
                setHasChanges(true);
              }}
              onWeekendChange={(value) => {
                setWeekendRate(value);
                setHasChanges(true);
              }}
              onSaveClick={handleSaveClick}
            />
            <ParkingDirectLinkCard
              slug={pricingData?.directBookingSlug}
              token={pricingData?.directBookingToken}
              commissionPct={pricingData?.commissionPct}
              directCommissionPct={pricingData?.directCommissionPct}
            />
          </div>
        </div>
      </AdminMobilePage>

      <PricingDateModal
        open={dateModalOpen && selectedDates.length > 0 && canEdit}
        onOpenChange={(open) => {
          setDateModalOpen(open);
          if (!open) clearSelection();
        }}
        selectedDates={selectedDates}
        suggestedPrice={suggestedPrice}
        newPrice={newPrice}
        onNewPriceChange={setNewPrice}
        onResetToDefault={resetSelectedToDefault}
        onApply={applyCustomPrice}
        mode={selectionMode}
        onBlock={() => void blockSelectedDates()}
        onUnblock={unblockSelectedDates}
        saving={saveMutation.isPending}
      />

      <PricingSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        saving={saveMutation.isPending}
        onConfirm={handleSaveConfirm}
      />
    </>
  );
}
