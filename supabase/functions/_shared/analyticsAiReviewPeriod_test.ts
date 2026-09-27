import {
  addDaysIso,
  currentAiReviewPeriodRange,
  resolveCurrentAiReviewPeriod,
} from './analyticsAiReviewPeriod.ts';

Deno.test('currentAiReviewPeriodRange — week is Sun–Sat containing today', () => {
  // 2026-09-27 is a Sunday
  const range = currentAiReviewPeriodRange('week', '2026-09-27');
  if (range.from !== '2026-09-27' || range.to !== '2026-10-03') {
    throw new Error(`unexpected week range ${JSON.stringify(range)}`);
  }
  const midWeek = currentAiReviewPeriodRange('week', '2026-09-30');
  if (midWeek.from !== '2026-09-27' || midWeek.to !== '2026-10-03') {
    throw new Error(`unexpected mid-week range ${JSON.stringify(midWeek)}`);
  }
});

Deno.test('currentAiReviewPeriodRange — month and year', () => {
  const month = currentAiReviewPeriodRange('month', '2026-09-15');
  if (month.from !== '2026-09-01' || month.to !== '2026-09-30') {
    throw new Error(`unexpected month ${JSON.stringify(month)}`);
  }
  const year = currentAiReviewPeriodRange('year', '2026-09-15');
  if (year.from !== '2026-01-01' || year.to !== '2026-12-31') {
    throw new Error(`unexpected year ${JSON.stringify(year)}`);
  }
});

Deno.test('resolveCurrentAiReviewPeriod — accepts current month only', () => {
  const today = '2026-09-27';
  const month = currentAiReviewPeriodRange('month', today);
  const ok = resolveCurrentAiReviewPeriod(month.from, month.to, today);
  if (!ok.ok || ok.kind !== 'month')
    throw new Error(`expected month ok, got ${JSON.stringify(ok)}`);

  const past = resolveCurrentAiReviewPeriod('2026-08-01', '2026-08-31', today);
  if (past.ok || past.reason !== 'not_current') {
    throw new Error(`expected not_current, got ${JSON.stringify(past)}`);
  }

  const custom = resolveCurrentAiReviewPeriod('2026-09-01', '2026-09-15', today);
  if (custom.ok || custom.reason !== 'custom') {
    throw new Error(`expected custom, got ${JSON.stringify(custom)}`);
  }

  const missing = resolveCurrentAiReviewPeriod(null, null, today);
  if (missing.ok || missing.reason !== 'missing') {
    throw new Error(`expected missing, got ${JSON.stringify(missing)}`);
  }
});

Deno.test('addDaysIso — calendar math', () => {
  if (addDaysIso('2026-09-30', 1) !== '2026-10-01') throw new Error('sep→oct');
  if (addDaysIso('2026-10-03', -6) !== '2026-09-27') throw new Error('back to sun');
});
