import { STATUS_TONE_HEX } from '@/lib/statusToneColors';

/** Income / positive series — matches booking **green** tone (teal-500). */
export const CHART_INCOME_COLOR = STATUS_TONE_HEX.green;

/** Expense / negative series — matches booking **red** tone (rose-500). */
export const CHART_EXPENSE_COLOR = STATUS_TONE_HEX.red;

/** Secondary metric series (e.g. bookings count) — matches **blue** tone (sky-500). */
export const CHART_INFO_COLOR = STATUS_TONE_HEX.blue;

export function formatChartMoneyAxis(value: number): string {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(0)}k`;
  return `₱${value}`;
}

export function defaultChartMargin(isMobile: boolean) {
  return isMobile
    ? { top: 8, right: 4, left: -6, bottom: 0 }
    : { top: 10, right: 10, left: 0, bottom: 0 };
}

export function chartAxisTick(isMobile: boolean) {
  return {
    fill: 'hsl(var(--muted-foreground))',
    fontSize: isMobile ? 10 : 12,
  };
}

export const CHART_HEIGHT_CLASS = 'h-[180px] w-full min-w-0 sm:h-[240px] lg:h-[300px]';
