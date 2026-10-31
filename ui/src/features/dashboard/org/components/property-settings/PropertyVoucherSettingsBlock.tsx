import { useMemo, useState } from 'react';

import { Minus, Plus } from 'lucide-react';

import { SettingsManageButton } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { VoucherRevealStylePicker } from '@/features/dashboard/org/components/property-settings/VoucherRevealStylePicker';
import type { PropertyVoucherPrize } from '@/features/dashboard/org/lib/propertyVoucherSettings';
import {
  VOUCHER_PRESET_PERCENTS,
  defaultChanceForPercent,
  formatVoucherOddsLabel,
  formatVoucherPrizeSummary,
  suggestPropertyVoucherCode,
  voucherDisplayPercents,
} from '@/features/dashboard/org/lib/propertyVoucherSettings';
import {
  DEFAULT_VOUCHER_REVEAL_STYLE,
  voucherRevealStyleLabel,
  type VoucherRevealStyle,
} from '@/features/dashboard/org/lib/voucherRevealStyle';
import { usePropertyPricingDefaults } from '@/features/dashboard/pricing/hooks/usePropertyPricing';
import {
  DEFAULT_WEEKDAY_NIGHTLY_RATE,
  DEFAULT_WEEKEND_NIGHTLY_RATE,
} from '@/features/dashboard/pricing/lib/pricingDefaults';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type PreviewBase = 'weekday' | 'weekend' | 'custom';

const PRESET_SET = new Set<number>(VOUCHER_PRESET_PERCENTS);

function prizeLabel(percentOff: number): string {
  return percentOff >= 100 ? 'Free stay' : `${percentOff}% off`;
}

function voucherSavingsPhp(baseNightly: number, percentOff: number): number {
  if (!Number.isFinite(baseNightly) || baseNightly <= 0) return 0;
  if (percentOff >= 100) return Math.round(baseNightly);
  return Math.round((baseNightly * percentOff) / 100);
}

function clampWeight(value: number): number {
  return Math.min(10_000, Math.max(1, Math.floor(value) || 1));
}

export function PropertyVoucherSettingsBlock({
  enabled,
  prizes,
  revealStyle,
  disabled,
  onEnabledChange,
  onPrizesChange,
  onRevealStyleChange,
  onInteract,
  manageNeedsAttention = false,
}: {
  enabled: boolean;
  prizes: PropertyVoucherPrize[];
  revealStyle: VoucherRevealStyle;
  disabled?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onPrizesChange: (prizes: PropertyVoucherPrize[]) => void;
  onRevealStyleChange: (style: VoucherRevealStyle) => void;
  onInteract?: () => void;
  manageNeedsAttention?: boolean;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [previewBase, setPreviewBase] = useState<PreviewBase>('weekday');
  const [customAmount, setCustomAmount] = useState('');

  const { defaults: pricingDefaults } = usePropertyPricingDefaults();
  const weekdayRate = pricingDefaults.weekdayNightlyRate || DEFAULT_WEEKDAY_NIGHTLY_RATE;
  const weekendRate = pricingDefaults.weekendNightlyRate || DEFAULT_WEEKEND_NIGHTLY_RATE;

  const previewNightly = useMemo(() => {
    if (previewBase === 'weekday') return weekdayRate;
    if (previewBase === 'weekend') return weekendRate;
    const parsed = Math.floor(Number(customAmount));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [previewBase, weekdayRate, weekendRate, customAmount]);

  const oddsByIndex = voucherDisplayPercents(prizes);
  const customPrizes = prizes
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !PRESET_SET.has(row.percentOff));

  const styleSummary =
    revealStyle !== DEFAULT_VOUCHER_REVEAL_STYLE
      ? ` · ${voucherRevealStyleLabel(revealStyle)}`
      : '';
  const summary = enabled ? `${formatVoucherPrizeSummary(prizes)}${styleSummary}` : 'Off';

  const findPresetRow = (percentOff: number) =>
    prizes.find((p) => p.percentOff === percentOff) ?? null;

  const setPresetEnabled = (percentOff: number, nextEnabled: boolean) => {
    onInteract?.();
    if (nextEnabled) {
      if (findPresetRow(percentOff)) return;
      const code = suggestPropertyVoucherCode(percentOff, prizes);
      onPrizesChange(
        [
          ...prizes,
          {
            code,
            percentOff,
            chancePercent: defaultChanceForPercent(percentOff),
          },
        ].sort((a, b) => a.percentOff - b.percentOff)
      );
      return;
    }
    onPrizesChange(prizes.filter((p) => p.percentOff !== percentOff));
  };

  const updateWeight = (index: number, weight: number) => {
    onInteract?.();
    onPrizesChange(
      prizes.map((row, i) => (i === index ? { ...row, chancePercent: clampWeight(weight) } : row))
    );
  };

  const removeCustomRow = (index: number) => {
    onInteract?.();
    onPrizesChange(prizes.filter((_, i) => i !== index));
  };

  const resetDefaults = () => {
    onInteract?.();
    onPrizesChange(
      VOUCHER_PRESET_PERCENTS.map((percentOff) => ({
        code: percentOff >= 100 ? 'FREE-STAY' : `OFF-${percentOff}`,
        percentOff,
        chancePercent: defaultChanceForPercent(percentOff),
      }))
    );
    onRevealStyleChange(DEFAULT_VOUCHER_REVEAL_STYLE);
  };

  return (
    <>
      <div className="bg-muted/40 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
        <p className="min-w-0 text-xs font-medium sm:text-sm">
          Next-stay vouchers
          <span className="text-muted-foreground font-normal"> · {summary}</span>
        </p>
        <SettingsManageButton
          disabled={disabled}
          needsAttention={manageNeedsAttention}
          onClick={() => setManageOpen(true)}
        />
      </div>

      <ResponsiveModal open={manageOpen} onOpenChange={setManageOpen}>
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex max-h-[min(92dvh,44rem)] w-[min(calc(100vw-1.5rem),36rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,36rem)] sm:p-0'
          )}
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              Next-stay vouchers
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div className="border-border/60 bg-muted/30 flex min-h-[44px] items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
                <Label
                  htmlFor="property-vouchers-enabled"
                  className="text-foreground min-w-0 flex-1 text-sm font-medium"
                >
                  Enable next-stay vouchers
                </Label>
                <Switch
                  id="property-vouchers-enabled"
                  checked={enabled}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    onInteract?.();
                    onEnabledChange(checked);
                  }}
                />
              </div>

              {enabled ? (
                <>
                  <VoucherRevealStylePicker
                    value={revealStyle}
                    disabled={disabled}
                    onInteract={onInteract}
                    onChange={onRevealStyleChange}
                  />

                  <div className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5">
                    <Select
                      value={previewBase}
                      onValueChange={(value) => setPreviewBase(value as PreviewBase)}
                      disabled={disabled}
                    >
                      <SelectTrigger
                        id="voucher-preview-base"
                        className="bg-background h-9 w-[8.5rem] shrink-0"
                        aria-label="Preview nightly rate"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekday">Weekday</SelectItem>
                        <SelectItem value="weekend">Weekend</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex min-w-0 items-center justify-end gap-1.5">
                      {previewBase === 'custom' ? (
                        <div className="relative w-[7.5rem] shrink-0">
                          <span className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                            ₱
                          </span>
                          <Input
                            id="voucher-preview-custom"
                            type="number"
                            min={1}
                            step={100}
                            inputMode="numeric"
                            disabled={disabled}
                            value={customAmount}
                            placeholder="0"
                            aria-label="Custom nightly amount"
                            className="h-9 pl-7 text-right tabular-nums"
                            onChange={(e) => setCustomAmount(e.target.value)}
                          />
                        </div>
                      ) : (
                        <p className="text-foreground text-sm font-semibold tabular-nums">
                          {formatMoney(previewNightly)}
                        </p>
                      )}
                      <span className="text-muted-foreground shrink-0 text-[11px]">/ night</span>
                    </div>
                  </div>

                  <div className="border-border/60 overflow-hidden rounded-xl border">
                    <div className="text-muted-foreground bg-muted/40 grid grid-cols-[minmax(0,1fr)_auto_4.5rem_minmax(4.5rem,auto)] gap-2 border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                      <span>Discount</span>
                      <span className="text-center">Weight</span>
                      <span className="text-center">Odds</span>
                      <span className="text-right">Savings</span>
                    </div>

                    <ul className="divide-border/50 divide-y">
                      {VOUCHER_PRESET_PERCENTS.map((percentOff) => {
                        const row = findPresetRow(percentOff);
                        const enabledRow = Boolean(row);
                        const prizeIndex = row ? prizes.indexOf(row) : -1;
                        const odds = prizeIndex >= 0 ? (oddsByIndex[prizeIndex] ?? 0) : 0;
                        const savings = voucherSavingsPhp(previewNightly, percentOff);

                        return (
                          <li
                            key={percentOff}
                            className={cn(
                              'grid grid-cols-[minmax(0,1fr)_auto_4.5rem_minmax(4.5rem,auto)] items-center gap-2 px-3 py-2.5',
                              !enabledRow && 'opacity-55'
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Checkbox
                                id={`voucher-prize-${percentOff}`}
                                checked={enabledRow}
                                disabled={disabled}
                                aria-label={`Include ${prizeLabel(percentOff)}`}
                                onCheckedChange={(checked) =>
                                  setPresetEnabled(percentOff, checked === true)
                                }
                              />
                              <Label
                                htmlFor={`voucher-prize-${percentOff}`}
                                className="cursor-pointer text-sm font-medium leading-none"
                              >
                                {prizeLabel(percentOff)}
                              </Label>
                            </div>

                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                disabled={disabled || !enabledRow}
                                aria-label={`Decrease weight for ${prizeLabel(percentOff)}`}
                                onClick={() => {
                                  if (!row || prizeIndex < 0) return;
                                  updateWeight(prizeIndex, row.chancePercent - 1);
                                }}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                max={10_000}
                                step={1}
                                inputMode="numeric"
                                disabled={disabled || !enabledRow}
                                value={enabledRow ? (row?.chancePercent ?? 1) : ''}
                                placeholder="-"
                                aria-label={`Weight for ${prizeLabel(percentOff)}`}
                                className="h-9 w-[3.25rem] min-w-[3.25rem] px-1.5 text-center tabular-nums"
                                onChange={(e) => {
                                  if (prizeIndex < 0) return;
                                  updateWeight(prizeIndex, Number(e.target.value));
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                disabled={disabled || !enabledRow}
                                aria-label={`Increase weight for ${prizeLabel(percentOff)}`}
                                onClick={() => {
                                  if (!row || prizeIndex < 0) return;
                                  updateWeight(prizeIndex, row.chancePercent + 1);
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            <p
                              className={cn(
                                'text-center text-sm font-semibold tabular-nums',
                                enabledRow ? 'text-foreground' : 'text-muted-foreground'
                              )}
                            >
                              {enabledRow ? formatVoucherOddsLabel(odds) : '-'}
                            </p>

                            <p
                              className={cn(
                                'text-right text-sm font-medium tabular-nums',
                                enabledRow && previewNightly > 0
                                  ? 'text-foreground'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {enabledRow && previewNightly > 0
                                ? percentOff >= 100
                                  ? formatMoney(savings)
                                  : `−${formatMoney(savings)}`
                                : '-'}
                            </p>
                          </li>
                        );
                      })}

                      {customPrizes.map(({ row, index }) => {
                        const odds = oddsByIndex[index] ?? 0;
                        const savings = voucherSavingsPhp(previewNightly, row.percentOff);
                        return (
                          <li
                            key={`${row.code}-${index}`}
                            className="grid grid-cols-[minmax(0,1fr)_auto_4.5rem_minmax(4.5rem,auto)] items-center gap-2 px-3 py-2.5"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="text-sm font-medium">{prizeLabel(row.percentOff)}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive h-8 px-2 text-xs"
                                disabled={disabled}
                                aria-label={`Remove ${prizeLabel(row.percentOff)}`}
                                onClick={() => removeCustomRow(index)}
                              >
                                Remove
                              </Button>
                            </div>
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                disabled={disabled}
                                aria-label={`Decrease weight for ${prizeLabel(row.percentOff)}`}
                                onClick={() => updateWeight(index, row.chancePercent - 1)}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                max={10_000}
                                step={1}
                                inputMode="numeric"
                                disabled={disabled}
                                value={row.chancePercent}
                                aria-label={`Weight for ${prizeLabel(row.percentOff)}`}
                                className="h-9 w-[3.25rem] min-w-[3.25rem] px-1.5 text-center tabular-nums"
                                onChange={(e) => updateWeight(index, Number(e.target.value))}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                disabled={disabled}
                                aria-label={`Increase weight for ${prizeLabel(row.percentOff)}`}
                                onClick={() => updateWeight(index, row.chancePercent + 1)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <p className="text-foreground text-center text-sm font-semibold tabular-nums">
                              {formatVoucherOddsLabel(odds)}
                            </p>
                            <p
                              className={cn(
                                'text-right text-sm font-medium tabular-nums',
                                previewNightly > 0 ? 'text-foreground' : 'text-muted-foreground'
                              )}
                            >
                              {previewNightly > 0
                                ? row.percentOff >= 100
                                  ? formatMoney(savings)
                                  : `−${formatMoney(savings)}`
                                : '-'}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <ResponsiveModalFooter className="border-border/60 shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-between sm:px-5">
            {enabled ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground min-h-[44px] w-full sm:w-auto"
                disabled={disabled}
                onClick={resetDefaults}
              >
                Reset defaults
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Button
              type="button"
              className="min-h-[44px] w-full sm:w-auto"
              onClick={() => setManageOpen(false)}
            >
              Done
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
