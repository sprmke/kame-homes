import { useCallback, useMemo, useState } from 'react';

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isToday,
  startOfMonth,
  startOfToday,
  subMonths,
} from 'date-fns';
import { Ban, ChevronLeft, ChevronRight } from 'lucide-react';

import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import { usePropertyPricing } from '@/features/dashboard/pricing/hooks/usePropertyPricing';
import { dateKey } from '@/features/dashboard/pricing/lib/pricingCalendarUtils';
import {
  propertyPricingDefaultsFromDto,
  resolveNightlyRateForDate,
} from '@/features/dashboard/pricing/lib/pricingCompute';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';

type Props = {
  selectedKeys: ReadonlySet<string>;
  onSelect: (item: AttachedContextItem) => void;
  compact?: boolean;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

export function ChatContextPricingCalendar({ selectedKeys, onSelect, compact }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const { data, isLoading, isError } = usePropertyPricing(month);

  const defaults = useMemo(() => propertyPricingDefaultsFromDto(data), [data]);
  const booked = useMemo(() => new Set(data?.bookedDateKeys ?? []), [data]);
  const blocked = useMemo(() => new Set(data?.blockedDateKeys ?? []), [data]);
  const overrides = data?.dateOverrides ?? {};
  const holidayRules = data?.holidayRules;
  const smartRecommendations = data?.smartRecommendations;

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const startPadding = getDay(startOfMonth(month));
  const today = startOfToday();

  const rateFor = useCallback(
    (date: Date) =>
      resolveNightlyRateForDate(date, defaults, {
        dateOverrides: overrides,
        holidayRules,
        smartRecommendations,
      }),
    [defaults, holidayRules, overrides, smartRecommendations]
  );

  const pinDate = (date: Date) => {
    const id = dateKey(date);
    onSelect({
      type: 'pricing_date',
      id,
      label: format(date, 'MMM d, yyyy'),
    });
  };

  return (
    <div className={cn('flex flex-col', compact ? 'p-1.5' : 'p-2')}>
      <div className="mb-1.5 flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[40px] min-w-[40px] shrink-0"
          aria-label="Previous month"
          onClick={() => setMonth((current) => startOfMonth(subMonths(current, 1)))}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="text-foreground min-w-0 flex-1 truncate text-center text-sm font-medium">
          {format(month, 'MMMM yyyy')}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[40px] min-w-[40px] shrink-0"
          aria-label="Next month"
          onClick={() => setMonth((current) => startOfMonth(addMonths(current, 1)))}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="text-muted-foreground mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-7 gap-0.5" aria-busy="true">
          {Array.from({ length: 28 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-muted-foreground px-2 py-6 text-center text-sm">
          Could not load pricing
        </p>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: startPadding }, (_, i) => (
            <span key={`pad-${i}`} aria-hidden />
          ))}
          {days.map((day) => {
            const key = dateKey(day);
            const isBooked = booked.has(key);
            const isBlocked = blocked.has(key);
            const isPast = isBefore(day, today);
            const isPinned = selectedKeys.has(`pricing_date:${key}`);
            const isCustom = overrides[key] != null;
            const price = rateFor(day);

            return (
              <button
                key={key}
                type="button"
                onClick={() => pinDate(day)}
                aria-pressed={isPinned}
                aria-label={`${format(day, 'MMMM d')}${isBooked ? ', booked' : ''}${isBlocked ? ', blocked' : ''}, ${formatMoneyCompact(price)}`}
                className={cn(
                  'native-press relative flex aspect-square min-h-0 flex-col items-center justify-center rounded-md border p-0.5 text-center transition-colors',
                  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
                  isBooked && 'bg-primary/15 border-primary/25',
                  isBlocked && !isBooked && 'bg-muted border-muted-foreground/25',
                  !isBooked && !isBlocked && 'bg-card border-border hover:border-primary/40',
                  isPast && !isBooked && 'opacity-50',
                  isPinned && 'ring-primary ring-2',
                  isToday(day) && !isPinned && 'ring-primary/50 ring-1'
                )}
              >
                <span
                  className={cn(
                    'text-[10px] font-semibold leading-none',
                    isToday(day) && !isBooked ? 'text-primary' : 'text-foreground',
                    (isBlocked || isPast) && !isBooked && 'text-muted-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {isBlocked && !isBooked ? (
                  <Ban className="text-muted-foreground mt-0.5 size-2.5" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      'mt-0.5 max-w-full truncate text-[9px] tabular-nums leading-none',
                      isBooked ? 'text-primary font-medium' : 'text-muted-foreground',
                      isCustom && !isBooked && 'text-amber-700 dark:text-amber-400'
                    )}
                  >
                    {isBooked ? 'Booked' : formatMoneyCompact(price)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px]">
        <span className="inline-flex items-center gap-1">
          <span className="bg-card border-border size-2 rounded-sm border" aria-hidden />
          Rate
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="bg-primary/15 border-primary/25 size-2 rounded-sm border" aria-hidden />
          Booked
        </span>
        <span className="inline-flex items-center gap-1">
          <Ban className="size-2.5" aria-hidden />
          Blocked
        </span>
      </div>
    </div>
  );
}
