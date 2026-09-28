import { Loader2, Save } from 'lucide-react';

import type { PropertyFeeConfig } from '@/features/dashboard/pricing/lib/pricingDefaults';
import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import {
  pricingRatesFormStackClassName,
  pricingRatesFormSurfaceClassName,
} from '@/features/dashboard/pricing/lib/pricingCalendarLayout';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  weekdayRate: number;
  weekendRate: number;
  fees: PropertyFeeConfig[];
  readOnly?: boolean;
  hasChanges?: boolean;
  saving?: boolean;
  /** Hide the card footer save button (Setup Guide uses modal footer save). */
  embedded?: boolean;
  onWeekdayChange: (value: number) => void;
  onWeekendChange: (value: number) => void;
  onAmountChange: (feeId: PropertyFeeConfig['id'], amount: number) => void;
  onSaveClick: () => void;
};

function MoneyInput({
  id,
  label,
  value,
  readOnly,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
}) {
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
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-10 pl-8 text-sm tabular-nums"
        />
      </div>
    </div>
  );
}

export function PricingRatesFormCard({
  weekdayRate,
  weekendRate,
  fees,
  readOnly = false,
  hasChanges = false,
  saving = false,
  embedded = false,
  onWeekdayChange,
  onWeekendChange,
  onAmountChange,
  onSaveClick,
}: Props) {
  const compactChrome = useDashboardCompactChrome();

  return (
    <section className={pricingRatesFormSurfaceClassName(compactChrome)}>
      <div className={pricingRatesFormStackClassName(compactChrome)}>
        <div>
          <h3 className="text-foreground text-sm font-semibold">Base rates</h3>
          <div className="mt-3 space-y-4">
            <MoneyInput
              id="weekday-rate"
              label="Weekday / night"
              value={weekdayRate}
              readOnly={readOnly}
              onChange={onWeekdayChange}
            />
            <MoneyInput
              id="weekend-rate"
              label="Fri–Sun / night"
              value={weekendRate}
              readOnly={readOnly}
              onChange={onWeekendChange}
            />
          </div>
        </div>

        <div className="border-border/60 border-t" role="separator" />

        <div>
          <h3 className="text-foreground text-sm font-semibold">Fees</h3>
          <ul className="mt-3 space-y-4">
            {fees.map((fee) => (
              <li key={fee.id}>
                <MoneyInput
                  id={`fee-${fee.id}`}
                  label={fee.label}
                  value={fee.amount}
                  readOnly={readOnly}
                  onChange={(amount) => onAmountChange(fee.id, amount)}
                />
              </li>
            ))}
          </ul>
        </div>

        {!embedded && canEditActions(readOnly, hasChanges) ? (
          <>
            <div className="border-border/60 border-t" role="separator" />
            <Button
              type="button"
              className="min-h-[44px] w-full"
              disabled={saving}
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

function canEditActions(readOnly: boolean, hasChanges: boolean) {
  return !readOnly && hasChanges;
}
