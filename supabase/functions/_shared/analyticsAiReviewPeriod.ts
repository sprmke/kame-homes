/**
 * AI Performance Review period gate — only the *current* Manila week / month / year.
 * Keep in sync with `ui/src/features/dashboard/analytics/lib/aiReviewPeriod.ts`.
 */

export type AiReviewPeriodKind = 'week' | 'month' | 'year';

export type ResolvedAiReviewPeriod =
  | { ok: true; kind: AiReviewPeriodKind; from: string; to: string }
  | { ok: false; reason: 'missing' | 'invalid' | 'custom' | 'not_current' };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseYmd(iso: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/** Calendar-date arithmetic on YYYY-MM-DD (no TZ shift). */
export function addDaysIso(dateIso: string, days: number): string {
  const parts = parseYmd(dateIso);
  if (!parts) throw new Error(`Invalid date: ${dateIso}`);
  const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function dayOfWeekSun0(dateIso: string): number {
  const parts = parseYmd(dateIso);
  if (!parts) throw new Error(`Invalid date: ${dateIso}`);
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay();
}

function isWeekShape(from: string, to: string): boolean {
  return dayOfWeekSun0(from) === 0 && addDaysIso(from, 6) === to;
}

function isMonthShape(from: string, to: string): boolean {
  const parts = parseYmd(from);
  if (!parts) return false;
  if (from !== `${parts.y}-${pad2(parts.m)}-01`) return false;
  const lastDay = new Date(Date.UTC(parts.y, parts.m, 0)).getUTCDate();
  return to === `${parts.y}-${pad2(parts.m)}-${pad2(lastDay)}`;
}

function isYearShape(from: string, to: string): boolean {
  const parts = parseYmd(from);
  if (!parts) return false;
  return from === `${parts.y}-01-01` && to === `${parts.y}-12-31`;
}

export function currentAiReviewPeriodRange(
  kind: AiReviewPeriodKind,
  todayIso: string
): { from: string; to: string } {
  const parts = parseYmd(todayIso);
  if (!parts) throw new Error(`Invalid today: ${todayIso}`);

  if (kind === 'week') {
    const dow = dayOfWeekSun0(todayIso);
    const from = addDaysIso(todayIso, -dow);
    return { from, to: addDaysIso(from, 6) };
  }

  if (kind === 'month') {
    const from = `${parts.y}-${pad2(parts.m)}-01`;
    const lastDay = new Date(Date.UTC(parts.y, parts.m, 0)).getUTCDate();
    return { from, to: `${parts.y}-${pad2(parts.m)}-${pad2(lastDay)}` };
  }

  return { from: `${parts.y}-01-01`, to: `${parts.y}-12-31` };
}

/**
 * Accept a host-supplied `from`/`to` only when it exactly matches the current
 * Manila week (Sun–Sat), month, or year.
 */
export function resolveCurrentAiReviewPeriod(
  from: string | null,
  to: string | null,
  todayIso: string
): ResolvedAiReviewPeriod {
  if (!from || !to) return { ok: false, reason: 'missing' };
  if (!parseYmd(from) || !parseYmd(to)) return { ok: false, reason: 'invalid' };

  for (const kind of ['week', 'month', 'year'] as const) {
    const range = currentAiReviewPeriodRange(kind, todayIso);
    if (range.from === from && range.to === to) {
      return { ok: true, kind, from, to };
    }
  }

  if (isWeekShape(from, to) || isMonthShape(from, to) || isYearShape(from, to)) {
    return { ok: false, reason: 'not_current' };
  }
  return { ok: false, reason: 'custom' };
}
