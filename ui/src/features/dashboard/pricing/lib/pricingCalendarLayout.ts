import { cn } from '@/lib/utils';

/** Calendar + rates sidebar grid on property and parking pricing pages. */
export function pricingCalendarFormGridClassName(compactChrome: boolean): string {
  return cn(
    'grid gap-3 lg:items-start',
    compactChrome
      ? 'lg:grid-cols-[minmax(0,1fr)_minmax(12.5rem,16rem)] lg:gap-3'
      : 'lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5'
  );
}

export function pricingCalendarWeekGapClassName(compactChrome: boolean): string {
  return compactChrome ? 'gap-1' : 'gap-1.5 sm:gap-2';
}

export function pricingCalendarOutsideCellClassName(compactChrome: boolean): string {
  return cn(
    'aspect-square',
    compactChrome ? 'min-h-[3rem] sm:min-h-[3.25rem]' : 'min-h-[3.5rem] sm:min-h-[4.5rem]'
  );
}

export function pricingRatesFormSurfaceClassName(compactChrome: boolean): string {
  return cn('surface-card', compactChrome ? 'p-3 sm:p-4' : 'p-4 sm:p-5');
}

export function pricingRatesFormStackClassName(compactChrome: boolean): string {
  return compactChrome ? 'space-y-4' : 'space-y-5';
}
