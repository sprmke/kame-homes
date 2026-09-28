import { AlertTriangle, Loader2, Save } from 'lucide-react';

import {
  STUB_COMMISSION_PCT,
  STUB_GUEST_PARKING_RATE_WEEKDAY,
  STUB_GUEST_PARKING_RATE_WEEKEND,
} from '@/features/dashboard/parking/lib/parkingPricingDefaults';
import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import {
  pricingRatesFormStackClassName,
  pricingRatesFormSurfaceClassName,
} from '@/features/dashboard/pricing/lib/pricingCalendarLayout';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  weekdayRate: number;
  weekendRate: number;
  /** Live super-admin-configured values — fall back to the stub defaults until loaded. */
  guestRateCapWeekday?: number;
  guestRateCapWeekend?: number;
  commissionPct?: number;
  readOnly?: boolean;
  hasChanges?: boolean;
  saving?: boolean;
  /** Hide the card footer save button (Setup Guide uses modal footer save). */
  embedded?: boolean;
  onWeekdayChange: (value: number) => void;
  onWeekendChange: (value: number) => void;
  onSaveClick: () => void;
};

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function MoneyInput({
  id,
  label,
  value,
  cap,
  commissionPct,
  readOnly,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  cap: number;
  commissionPct: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
}) {
  const overCap = value > cap;
  const serviceFee = Math.round(value * commissionPct);
  const netPayout = value - serviceFee;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-muted-foreground text-sm">
        {label}
      </Label>
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
          ₱
        </span>
        <Input
          id={id}
          type="number"
          min={0}
          step={1}
          value={value}
          disabled={readOnly}
          aria-invalid={overCap}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            'h-10 pl-8 text-sm tabular-nums',
            overCap && 'border-destructive focus-visible:ring-destructive'
          )}
        />
      </div>
      {overCap ? (
        <p className="text-destructive flex items-start gap-1.5 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Above max {formatPhp(cap)} — lower to save and offer to guests.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Service fee {formatPhp(serviceFee)} · You get {formatPhp(netPayout)} / night
        </p>
      )}
    </div>
  );
}

export function ParkingPricingRatesFormCard({
  weekdayRate,
  weekendRate,
  guestRateCapWeekday = STUB_GUEST_PARKING_RATE_WEEKDAY,
  guestRateCapWeekend = STUB_GUEST_PARKING_RATE_WEEKEND,
  commissionPct = STUB_COMMISSION_PCT,
  readOnly = false,
  hasChanges = false,
  saving = false,
  embedded = false,
  onWeekdayChange,
  onWeekendChange,
  onSaveClick,
}: Props) {
  const compactChrome = useDashboardCompactChrome();
  const capExceeded = weekdayRate > guestRateCapWeekday || weekendRate > guestRateCapWeekend;

  return (
    <section className={pricingRatesFormSurfaceClassName(compactChrome)}>
      <div className={pricingRatesFormStackClassName(compactChrome)}>
        <div>
          <h3 className="text-foreground text-sm font-semibold">Base rates</h3>
          <div className="mt-3 space-y-4">
            <MoneyInput
              id="parking-weekday-rate"
              label="Weekday / night"
              value={weekdayRate}
              cap={guestRateCapWeekday}
              commissionPct={commissionPct}
              readOnly={readOnly}
              onChange={onWeekdayChange}
            />
            <MoneyInput
              id="parking-weekend-rate"
              label="Fri–Sun / night"
              value={weekendRate}
              cap={guestRateCapWeekend}
              commissionPct={commissionPct}
              readOnly={readOnly}
              onChange={onWeekendChange}
            />
          </div>
        </div>

        {!embedded && !readOnly && hasChanges ? (
          <>
            <div className="border-border/60 border-t" role="separator" />
            <Button
              type="button"
              className="min-h-[44px] w-full"
              disabled={saving || capExceeded}
              onClick={onSaveClick}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}
