import type { SmartPricingDiffRow } from '@/features/dashboard/pricing/lib/smartPricingApi';

export type PriceTone = 'up' | 'same' | 'down';

export function priceTone(baseRate: number, rate: number): PriceTone {
  if (baseRate <= 0) return 'same';
  const d = (rate - baseRate) / baseRate;
  if (d > 0.015) return 'up';
  if (d < -0.015) return 'down';
  return 'same';
}

export function round50(n: number): number {
  return Math.max(0, Math.round(n / 50) * 50);
}

/** Compact ₱ for calendar cells: ₱3.9k / ₱950. */
export function pesoCompact(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `₱${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return `₱${Math.round(n)}`;
}

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export function peso(n: number): string {
  return PESO.format(Math.round(n));
}

/** Signed compact delta for driver rows: `+₱180` / `−₱90`. */
export function signedPeso(n: number): string {
  const v = round50(Math.abs(n));
  if (v < 50) return '₱0';
  return `${n > 0 ? '+' : '−'}${peso(v)}`;
}

export type MonthToneCounts = { up: number; down: number; same: number };

export function monthToneCounts(rows: SmartPricingDiffRow[]): MonthToneCounts {
  const out: MonthToneCounts = { up: 0, down: 0, same: 0 };
  for (const r of rows) {
    out[priceTone(r.baseRate, r.recommendedRate)] += 1;
  }
  return out;
}

export type MonthDriver = {
  id: string;
  /** Short title, e.g. "Weekends lower". */
  label: string;
  /** One-line fact: "avg −₱100 · 4 nights". */
  detail: string;
  nights: number;
  avgDelta: number;
  tone: 'up' | 'down' | 'note';
};

function directedLabel(base: string, avgDelta: number): string {
  if (avgDelta > 0) return `${base} higher`;
  if (avgDelta < 0) return `${base} lower`;
  return base;
}

function driverDetail(nights: number, avgDelta: number): string {
  const n = `${nights} night${nights === 1 ? '' : 's'}`;
  if (Math.abs(avgDelta) < 50) return n;
  return `avg ${signedPeso(avgDelta)} · ${n}`;
}

/**
 * Fact drivers for the month currently on screen — not the whole preview window.
 * Built from engine factor keys + per-night ₱ deltas (no AI prose).
 */
export function buildMonthDrivers(rows: SmartPricingDiffRow[]): MonthDriver[] {
  const changed = rows.filter((r) => r.recommendedRate !== r.baseRate);
  if (changed.length === 0) return [];

  const out: MonthDriver[] = [];

  const pushGroup = (
    id: string,
    baseLabel: string,
    subset: SmartPricingDiffRow[],
    opts?: { toneHint?: 'up' | 'down'; fixedLabel?: boolean }
  ) => {
    if (subset.length === 0) return;
    const avg = subset.reduce((s, r) => s + (r.recommendedRate - r.baseRate), 0) / subset.length;
    const avgR = round50(avg);
    // Keep groups with a clear direction even when the rounded avg is tiny.
    if (Math.abs(avg) < 25 && subset.length < 2) return;
    const tone: MonthDriver['tone'] =
      opts?.toneHint ?? (avg > 15 ? 'up' : avg < -15 ? 'down' : 'note');
    const label = opts?.fixedLabel ? baseLabel : directedLabel(baseLabel, avgR !== 0 ? avgR : avg);
    // Prefer rounded avg for display; fall back to raw when rounding would hide a real move.
    const displayDelta =
      avgR !== 0 ? avgR : round50(avg) || (Math.abs(avg) >= 25 ? Math.sign(avg) * 50 : 0);
    out.push({
      id,
      label,
      detail: driverDetail(subset.length, displayDelta),
      nights: subset.length,
      avgDelta: displayDelta,
      tone,
    });
  };

  // Host holiday / season rules first — named, explicit.
  const byRule = new Map<string, SmartPricingDiffRow[]>();
  for (const r of changed) {
    const f = r.factors.find((x) => x.key === 'season_rule');
    if (!f) continue;
    const arr = byRule.get(f.label) ?? [];
    arr.push(r);
    byRule.set(f.label, arr);
  }
  for (const [name, subset] of byRule) {
    pushGroup(`rule:${name}`, name, subset, { fixedLabel: true });
  }

  // Weekends not already covered by a named rule.
  const weekends = changed.filter(
    (r) =>
      (r.weekday === 0 || r.weekday === 5 || r.weekday === 6) &&
      !r.factors.some((f) => f.key === 'season_rule')
  );
  pushGroup('weekends', 'Weekends', weekends);

  const weekdays = changed.filter(
    (r) =>
      r.weekday >= 1 &&
      r.weekday <= 4 &&
      !r.factors.some((f) => f.key === 'season_rule' || f.key === 'orphan' || f.key === 'lead_time')
  );
  if (weekdays.length >= 3) {
    pushGroup('weekdays', 'Weekdays', weekdays);
  }

  pushGroup(
    'orphan',
    'Gap nights',
    changed.filter((r) => r.factors.some((f) => f.key === 'orphan')),
    { toneHint: 'down' }
  );

  pushGroup(
    'lead',
    'Last-minute',
    changed.filter((r) => r.factors.some((f) => f.key === 'lead_time')),
    { toneHint: 'down' }
  );

  pushGroup(
    'pace',
    'Selling fast',
    changed.filter((r) => r.factors.some((f) => f.key === 'pace')),
    { toneHint: 'up' }
  );

  const hitFloor = changed.filter((r) => r.clampedBy === 'min');
  if (hitFloor.length) {
    out.push({
      id: 'floor',
      label: 'Held at your min',
      detail: driverDetail(hitFloor.length, 0),
      nights: hitFloor.length,
      avgDelta: 0,
      tone: 'note',
    });
  }
  const hitCeil = changed.filter((r) => r.clampedBy === 'max');
  if (hitCeil.length) {
    out.push({
      id: 'ceil',
      label: 'Held at your max',
      detail: driverDetail(hitCeil.length, 0),
      nights: hitCeil.length,
      avgDelta: 0,
      tone: 'note',
    });
  }

  // Cap noise — prefer the strongest named drivers.
  return out
    .sort((a, b) => Math.abs(b.avgDelta) * b.nights - Math.abs(a.avgDelta) * a.nights)
    .slice(0, 5);
}

export type DayFactorLine = {
  label: string;
  detail: string;
  tone: 'up' | 'down' | 'note';
};

/** Per-night factor lines for a tapped calendar cell. */
export function buildDayFactorLines(row: SmartPricingDiffRow): DayFactorLine[] {
  const delta = row.recommendedRate - row.baseRate;
  const lines: DayFactorLine[] = [];

  for (const f of row.factors) {
    const pct = Math.round((f.multiplier - 1) * 100);
    if (pct === 0) continue;
    const short =
      f.key === 'dow'
        ? 'Day of week'
        : f.key === 'season_demand'
          ? 'Season'
          : f.key === 'season_rule'
            ? f.label
            : f.key === 'lead_time'
              ? f.label
              : f.key === 'orphan'
                ? 'Gap night'
                : f.key === 'pace'
                  ? 'Selling fast'
                  : f.label;
    lines.push({
      label: short,
      detail: `${pct > 0 ? '+' : ''}${pct}%`,
      tone: pct > 0 ? 'up' : 'down',
    });
  }

  if (row.clampedBy === 'min') {
    lines.push({ label: 'Floor', detail: 'min price', tone: 'note' });
  } else if (row.clampedBy === 'max') {
    lines.push({ label: 'Ceiling', detail: 'max price', tone: 'note' });
  }

  if (lines.length === 0 && delta !== 0) {
    lines.push({
      label: 'Adjusted',
      detail: signedPeso(delta),
      tone: delta > 0 ? 'up' : 'down',
    });
  }

  return lines;
}

/** Chip next to the 30-night totals — always the peso delta when totals move. */
export function previewChip(currentTotal: number, smartTotal: number): string {
  const diff = round50(smartTotal) - round50(currentTotal);
  if (diff === 0) return 'No change';
  return signedPeso(diff);
}
