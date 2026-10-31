/** Manila-aware date-range presets for the Analytics controls. Mirrors financePeriod.ts's shape. */

export type AnalyticsRangePreset = 'this-month' | 'last-30d' | 'last-90d' | 'last-12mo' | 'custom';

export function manilaTodayIso(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    .toISOString()
    .slice(0, 10);
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function rangeForPreset(preset: AnalyticsRangePreset): { from: string; to: string } {
  const today = manilaTodayIso();
  switch (preset) {
    case 'last-30d':
      return { from: addDaysIso(today, -29), to: today };
    case 'last-90d':
      return { from: addDaysIso(today, -89), to: today };
    case 'last-12mo':
      return { from: addDaysIso(today, -364), to: today };
    case 'this-month': {
      const [y, m] = today.split('-').map(Number);
      const from = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to };
    }
    case 'custom':
    default:
      return { from: addDaysIso(today, -29), to: today };
  }
}

export const ANALYTICS_RANGE_PRESET_LABELS: Record<AnalyticsRangePreset, string> = {
  'this-month': 'This month',
  'last-30d': 'Last 30 days',
  'last-90d': 'Last 90 days',
  'last-12mo': 'Last 12 months',
  custom: 'Custom',
};
