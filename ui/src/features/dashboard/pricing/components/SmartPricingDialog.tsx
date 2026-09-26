import { useEffect, useMemo, useRef, useState } from 'react';

import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';

import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import {
  useApplySmartPricing,
  useClearSmartPricing,
  usePreviewSmartPricing,
  useSaveSmartPricingSettings,
  useSmartPricingSettings,
} from '@/features/dashboard/pricing/hooks/useSmartPricing';
import {
  STRATEGY_OPTIONS,
  type SmartPricingDiffRow,
  type SmartPricingMode,
  type SmartPricingPreview,
  type SmartPricingSettingsPatch,
} from '@/features/dashboard/pricing/lib/smartPricingApi';
import {
  buildDayFactorLines,
  buildMonthDrivers,
  monthToneCounts,
  peso,
  pesoCompact,
  previewChip,
  priceTone,
  round50,
} from '@/features/dashboard/pricing/lib/smartPricingPreviewExplain';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveModalTitle } from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** No `pricing.rates:edit` permission — view-only. */
  readOnly?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Preview calendar + month drivers
// ─────────────────────────────────────────────────────────────────────────────

function groupDiffByMonth(diff: SmartPricingDiffRow[]): Array<[string, SmartPricingDiffRow[]]> {
  const map = new Map<string, SmartPricingDiffRow[]>();
  for (const r of diff) {
    const key = r.date.slice(0, 7);
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function MiniCalendar({
  byMonth,
  monthIdx,
  onMonthIdxChange,
  selectedDate,
  onSelectDate,
}: {
  byMonth: Array<[string, SmartPricingDiffRow[]]>;
  monthIdx: number;
  onMonthIdxChange: (idx: number) => void;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  if (byMonth.length === 0) return null;

  const safeIdx = Math.min(monthIdx, byMonth.length - 1);
  const monthEntry = byMonth[safeIdx]!;
  const [monthKey, monthRows] = monthEntry;
  const [year, month] = monthKey.split('-').map(Number);
  const byDay = new Map(monthRows.map((r) => [Number(r.date.slice(8, 10)), r]));

  const firstDow = new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex size-9 items-center justify-center disabled:opacity-30"
          disabled={safeIdx === 0}
          onClick={() => {
            onMonthIdxChange(safeIdx - 1);
            onSelectDate(null);
          }}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">
          {MONTHS[month! - 1]} {year}
        </span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex size-9 items-center justify-center disabled:opacity-30"
          disabled={safeIdx === byMonth.length - 1}
          onClick={() => {
            onMonthIdxChange(safeIdx + 1);
            onSelectDate(null);
          }}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px px-2 pb-1">
        {DOW_LETTERS.map((d, i) => (
          <div key={i} className="text-muted-foreground pb-1 text-center text-[10px] font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 px-2 pb-2">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const row = byDay.get(day);
          if (!row) {
            return (
              <div
                key={i}
                className="bg-muted/30 text-muted-foreground/40 flex h-14 flex-col items-center justify-center rounded-md text-[11px]"
              >
                {day}
              </div>
            );
          }
          const tone = priceTone(row.baseRate, row.recommendedRate);
          const selected = selectedDate === row.date;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(selected ? null : row.date)}
              aria-label={`${MONTHS[month! - 1]} ${day}, ${peso(row.recommendedRate)}${
                tone !== 'same' ? `, was ${peso(row.baseRate)}` : ''
              }`}
              aria-pressed={selected}
              className={cn(
                'flex h-14 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] leading-none transition-colors',
                tone === 'up' &&
                  'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
                tone === 'down' &&
                  'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
                tone === 'same' && 'bg-muted/60 text-foreground',
                selected && 'ring-primary ring-2 ring-offset-1'
              )}
            >
              <span className="text-[11px] font-medium">{day}</span>
              {tone !== 'same' ? (
                <span className="line-through opacity-60">{pesoCompact(row.baseRate)}</span>
              ) : null}
              <span className="font-semibold tabular-nums">{pesoCompact(row.recommendedRate)}</span>
            </button>
          );
        })}
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2 text-[11px]">
        <Legend className="bg-emerald-400" label="Higher" />
        <Legend className="bg-muted-foreground/40" label="Same" />
        <Legend className="bg-amber-400" label="Lower" />
        <Legend className="bg-muted-foreground/15" label="Booked" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('size-2 rounded-[3px]', className)} />
      {label}
    </span>
  );
}

function PreviewBody({ preview, mode }: { preview: SmartPricingPreview; mode: SmartPricingMode }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const byMonth = useMemo(() => groupDiffByMonth(preview.diff), [preview.diff]);
  const firstChangedIdx = useMemo(() => {
    const i = byMonth.findIndex(([, rows]) => rows.some((r) => r.recommendedRate !== r.baseRate));
    return i === -1 ? 0 : i;
  }, [byMonth]);
  const [monthIdx, setMonthIdx] = useState(firstChangedIdx);
  useEffect(() => {
    setMonthIdx(firstChangedIdx);
    setSelectedDate(null);
  }, [firstChangedIdx, preview.runId]);

  const monthRows = byMonth[Math.min(monthIdx, Math.max(byMonth.length - 1, 0))]?.[1] ?? [];
  const cur = round50(preview.next30.currentTotal);
  const sm = round50(preview.next30.smartTotal);
  const chip = previewChip(preview.next30.currentTotal, preview.next30.smartTotal);
  const counts = useMemo(() => monthToneCounts(monthRows), [monthRows]);
  const drivers = useMemo(() => buildMonthDrivers(monthRows), [monthRows]);
  const selectedRow = selectedDate
    ? (preview.diff.find((r) => r.date === selectedDate) ?? null)
    : null;
  const dayLines = selectedRow ? buildDayFactorLines(selectedRow) : [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-muted-foreground text-sm tabular-nums line-through">
            {peso(cur)}
          </span>
          <span className="text-muted-foreground text-sm">→</span>
          <span className="text-xl font-semibold tabular-nums">{peso(sm)}</span>
          <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px] font-medium">
            {chip}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Next {preview.next30.nights} open nights
          {mode === 'autopilot' ? ' · applies automatically tonight' : null}
        </p>
      </div>

      <MiniCalendar
        byMonth={byMonth}
        monthIdx={monthIdx}
        onMonthIdxChange={setMonthIdx}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {selectedRow ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {selectedRow.date.slice(8, 10)}{' '}
              {MONTHS[Number(selectedRow.date.slice(5, 7)) - 1]?.slice(0, 3)}
            </span>
            <span className="tabular-nums">
              {priceTone(selectedRow.baseRate, selectedRow.recommendedRate) !== 'same' ? (
                <span className="text-muted-foreground mr-1.5 line-through">
                  {peso(selectedRow.baseRate)}
                </span>
              ) : null}
              <span className="font-semibold">{peso(selectedRow.recommendedRate)}</span>
            </span>
          </div>
          {dayLines.length ? (
            <ul className="space-y-1.5">
              {dayLines.map((line) => (
                <li
                  key={line.label}
                  className="flex items-center justify-between gap-2 text-xs tabular-nums"
                >
                  <span className="text-muted-foreground flex items-center gap-2">
                    <ToneDot tone={line.tone} />
                    {line.label}
                  </span>
                  <span className="font-medium">{line.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">No change from your rate</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium">This month</div>
            {(counts.up > 0 || counts.down > 0 || counts.same > 0) && (
              <div className="text-muted-foreground flex flex-wrap gap-x-2.5 text-[11px] tabular-nums">
                {counts.up > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400">{counts.up} higher</span>
                ) : null}
                {counts.down > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400">{counts.down} lower</span>
                ) : null}
                {counts.same > 0 ? <span>{counts.same} same</span> : null}
              </div>
            )}
          </div>
          {drivers.length ? (
            <ul className="space-y-2">
              {drivers.map((d) => (
                <li key={d.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1.5">
                    <ToneDot tone={d.tone} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground font-medium">{d.label}</span>
                    <span className="text-muted-foreground mt-0.5 block tabular-nums">
                      {d.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">No price changes in this month</p>
          )}
          <p className="text-muted-foreground text-[11px]">Tap a night for its breakdown</p>
        </div>
      )}
    </div>
  );
}

function ToneDot({ tone }: { tone: 'up' | 'down' | 'note' }) {
  return (
    <span
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        tone === 'up' && 'bg-emerald-500',
        tone === 'down' && 'bg-amber-500',
        tone === 'note' && 'bg-muted-foreground/40'
      )}
      aria-hidden
    />
  );
}

function SmartPricingSettingsSkeleton({ expanded }: { expanded: boolean }) {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-label="Loading Smart Pricing">
      <div className="flex items-center justify-between gap-3" aria-hidden>
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
      </div>

      {expanded ? (
        <div className="space-y-5" aria-hidden>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-64 max-w-full" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="min-h-[44px] rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="min-h-[44px] rounded-lg" />
              <Skeleton className="min-h-[44px] rounded-lg" />
            </div>
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function SmartPricingDialog({ open, onOpenChange, readOnly }: Props) {
  const gate = useFeatureGate('smartPricing');
  const canWrite = !readOnly && gate.canUse;

  const { data, isLoading, isError, refetch } = useSmartPricingSettings({ enabled: open });
  const saveMut = useSaveSmartPricingSettings();
  const previewMut = usePreviewSmartPricing();
  const applyMut = useApplySmartPricing();
  const clearMut = useClearSmartPricing();

  const s = data?.settings;
  const preview = previewMut.data;
  const busy =
    saveMut.isPending || previewMut.isPending || applyMut.isPending || clearMut.isPending;
  const hasApplied = (data?.appliedCount ?? 0) > 0 && !clearMut.isSuccess;

  const [floorInput, setFloorInput] = useState('');
  const [ceilInput, setCeilInput] = useState('');
  const [confirmOff, setConfirmOff] = useState(false);
  const seededFrom = useRef<string | null>(null);
  const autoSeeded = useRef(false);

  const weekdayBase = data?.resolvedBase.weekday ?? 0;
  const suggestedFloor = weekdayBase ? round50(weekdayBase * 0.9) : 0;
  const suggestedCeiling = weekdayBase ? round50(weekdayBase * 1.25) : 0;

  useEffect(() => {
    if (!open || !data) return;
    const key = `${data.settings.minPrice ?? ''}|${data.settings.maxPrice ?? ''}`;
    if (seededFrom.current === key) return;
    seededFrom.current = key;
    setFloorInput(data.settings.minPrice != null ? String(data.settings.minPrice) : '');
    setCeilInput(data.settings.maxPrice != null ? String(data.settings.maxPrice) : '');
  }, [open, data]);

  useEffect(() => {
    if (!open) {
      previewMut.reset();
      clearMut.reset();
      seededFrom.current = null;
      autoSeeded.current = false;
      setConfirmOff(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (fields: SmartPricingSettingsPatch) => {
    if (!canWrite) return;
    saveMut.mutate(fields);
  };

  useEffect(() => {
    if (!open || autoSeeded.current || !canWrite || !s?.enabled || saveMut.isPending) return;
    const seed: SmartPricingSettingsPatch = {};
    if (s.minPrice == null && suggestedFloor > 0) seed.minPrice = suggestedFloor;
    if (s.maxPrice == null && suggestedCeiling > 0) seed.maxPrice = suggestedCeiling;
    if (Object.keys(seed).length === 0) return;
    autoSeeded.current = true;
    if (seed.minPrice != null) setFloorInput(String(seed.minPrice));
    if (seed.maxPrice != null) setCeilInput(String(seed.maxPrice));
    saveMut.mutate(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, s?.enabled, s?.minPrice, s?.maxPrice, suggestedFloor, suggestedCeiling, canWrite]);

  const commitFloor = () => {
    const raw = floorInput.trim();
    const n = raw === '' ? suggestedFloor : Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    if (raw === '') setFloorInput(n > 0 ? String(n) : '');
    if (n !== (s?.minPrice ?? null)) patch({ minPrice: n > 0 ? n : null });
  };
  const commitCeil = () => {
    const raw = ceilInput.trim();
    const n = raw === '' ? null : Number(raw);
    if (n !== null && (!Number.isFinite(n) || n <= 0)) return;
    if (n !== (s?.maxPrice ?? null)) patch({ maxPrice: n });
  };

  const previewChanged = preview
    ? preview.diff.filter((r) => r.recommendedRate !== r.baseRate).length > 0
    : false;

  const view: 'loading' | 'error' | 'settings' | 'preview' = isLoading
    ? 'loading'
    : isError || !s
      ? 'error'
      : preview
        ? 'preview'
        : 'settings';

  const confirmDisable = () => {
    patch({ enabled: false });
    clearMut.mutate();
    setConfirmOff(false);
  };

  const footer =
    view === 'loading' ? (
      <Skeleton className="h-10 min-h-[44px] w-full rounded-lg sm:min-h-10 sm:w-24" aria-hidden />
    ) : view === 'error' ? (
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] sm:min-h-10"
        onClick={() => void refetch()}
      >
        Retry
      </Button>
    ) : view === 'preview' ? (
      <>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] gap-1.5 sm:min-h-10"
          onClick={() => previewMut.reset()}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        {previewChanged ? (
          <Button
            type="button"
            className="min-h-[44px] sm:min-h-10"
            disabled={!canWrite || applyMut.isPending}
            onClick={() =>
              applyMut.mutate({ runId: preview!.runId }, { onSuccess: () => onOpenChange(false) })
            }
          >
            {applyMut.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
            ) : null}
            {s!.mode === 'autopilot' ? 'Apply now' : 'Apply'}
          </Button>
        ) : null}
      </>
    ) : !s!.enabled ? (
      <Button
        type="button"
        className="min-h-[44px] sm:min-h-10"
        disabled={!canWrite || busy}
        onClick={() => patch({ enabled: true })}
      >
        {saveMut.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
        Turn on
      </Button>
    ) : (
      <Button
        type="button"
        className="min-h-[44px] gap-1.5 sm:min-h-10"
        disabled={!canWrite || busy}
        onClick={() => previewMut.mutate({ explain: false })}
      >
        {previewMut.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {hasApplied ? 'Preview again' : 'Preview'}
      </Button>
    );

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={(next) => {
          if (!next && confirmOff) return;
          onOpenChange(next);
        }}
        title={
          <ResponsiveModalTitle className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" aria-hidden />
            Smart Pricing
          </ResponsiveModalTitle>
        }
        sizeClassName="max-w-[min(calc(100vw-1.5rem),42rem)] sm:max-w-[min(95vw,42rem)]"
        heightClassName="max-h-[min(92dvh,44rem)]"
        footerClassName={view === 'preview' && previewChanged ? 'sm:justify-between' : undefined}
        footer={footer}
        contentClassName={confirmOff ? 'pointer-events-none' : undefined}
      >
        {!canWrite ? (
          <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {readOnly
              ? 'View only. Pricing-rates permission required to edit.'
              : 'Pro plan required to enable.'}
          </div>
        ) : null}

        {view === 'loading' ? (
          <SmartPricingSettingsSkeleton expanded={canWrite} />
        ) : view === 'error' ? (
          <p className="text-destructive text-sm">Could not load Smart Pricing.</p>
        ) : view === 'preview' ? (
          <PreviewBody preview={preview!} mode={s!.mode} />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">Smart Pricing</div>
                <div className="text-muted-foreground text-xs">
                  {s!.enabled
                    ? hasApplied
                      ? `${data!.appliedCount} night${data!.appliedCount === 1 ? '' : 's'} priced`
                      : 'Adjusts open nights within your limits'
                    : 'Off. Turn on to set strength and limits'}
                </div>
              </div>
              <Switch
                checked={s!.enabled}
                disabled={!canWrite || busy}
                onCheckedChange={(v) => (v ? patch({ enabled: true }) : setConfirmOff(true))}
                aria-label={s!.enabled ? 'Turn Smart Pricing off' : 'Turn Smart Pricing on'}
              />
            </div>

            {s!.enabled ? (
              <>
                <div className="space-y-2">
                  <div>
                    <div className="text-sm font-medium">Strength</div>
                    <p className="text-muted-foreground text-xs">
                      How far each night can move before your holiday rates
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {STRATEGY_OPTIONS.map((opt) => {
                      const active = s!.aggressiveness === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={!canWrite}
                          onClick={() => patch({ aggressiveness: opt.value })}
                          className={cn(
                            'min-h-[44px] rounded-lg border px-2 py-2 text-center transition-colors',
                            active
                              ? 'border-primary bg-primary/5 ring-primary/30 ring-1'
                              : 'hover:bg-accent'
                          )}
                        >
                          <div className="text-sm font-medium">{opt.label}</div>
                          <div className="text-muted-foreground mt-0.5 text-[11px]">
                            {opt.range}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Price limits</div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Never below</span>
                      <span className="relative block">
                        <span className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm">
                          ₱
                        </span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="h-10 pl-6"
                          disabled={!canWrite}
                          value={floorInput}
                          placeholder={suggestedFloor ? String(suggestedFloor) : ''}
                          onChange={(e) => setFloorInput(e.target.value)}
                          onBlur={commitFloor}
                          aria-label="Minimum nightly price"
                        />
                      </span>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Never above</span>
                      <span className="relative block">
                        <span className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm">
                          ₱
                        </span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="h-10 pl-6"
                          disabled={!canWrite}
                          value={ceilInput}
                          placeholder={suggestedCeiling ? String(suggestedCeiling) : ''}
                          onChange={(e) => setCeilInput(e.target.value)}
                          onBlur={commitCeil}
                          aria-label="Maximum nightly price"
                        />
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">When prices update</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['review_only', 'When I approve'],
                        ['autopilot', 'Automatically'],
                      ] as const
                    ).map(([value, label]) => {
                      const active = s!.mode === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={!canWrite}
                          onClick={() =>
                            patch({ mode: value, aiRationaleEnabled: value === 'autopilot' })
                          }
                          className={cn(
                            'min-h-[44px] rounded-lg border px-2 py-2 text-center text-sm font-medium transition-colors',
                            active
                              ? 'border-primary bg-primary/5 ring-primary/30 ring-1'
                              : 'hover:bg-accent'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {s!.mode === 'autopilot'
                      ? 'Updates nightly on its own. Preview anytime to review.'
                      : 'Nothing changes until you preview and apply.'}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        )}
      </AdminDialogShell>

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent className="max-w-[min(calc(100vw-1.5rem),26rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off Smart Pricing?</AlertDialogTitle>
            <AlertDialogDescription>Resets nights back to your saved rates.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisable}>Turn off</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
