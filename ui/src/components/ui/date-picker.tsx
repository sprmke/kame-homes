import * as React from 'react';

import { format, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DATE_FNS_PICKER_DISPLAY_FORMAT, DATE_PICKER_DISPLAY_FORMAT } from '@/utils/format/dates';

import type { Matcher } from 'react-day-picker';

interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  rangeEnd?: Date; // For showing the range visually
}

function buildDisabledMatchers(
  minDate?: Date,
  maxDate?: Date,
  disabled?: (date: Date) => boolean
): Matcher | Matcher[] | undefined {
  const matchers: Matcher[] = [];
  if (minDate) {
    matchers.push({ before: startOfDay(minDate) });
  }
  if (maxDate) {
    matchers.push({ after: startOfDay(maxDate) });
  }
  if (disabled) {
    matchers.push(disabled);
  }
  if (matchers.length === 0) return undefined;
  if (matchers.length === 1) return matchers[0];
  return matchers;
}

export function DatePicker({
  date,
  onSelect,
  disabled,
  placeholder = DATE_PICKER_DISPLAY_FORMAT,
  minDate,
  maxDate,
  className,
  rangeEnd,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const disabledMatchers = React.useMemo(
    () => buildDisabledMatchers(minDate, maxDate, disabled),
    [minDate, maxDate, disabled]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn(
            'h-10 w-full justify-start rounded-lg px-3 py-2 text-left font-normal',
            !date ? 'text-muted-foreground' : 'text-foreground',
            className
          )}
        >
          <CalendarIcon
            className={cn(
              'mr-2 h-4 w-4 flex-shrink-0',
              !date ? 'text-muted-foreground' : 'text-foreground'
            )}
            aria-hidden
          />
          {date ? (
            <span className="truncate">{format(date, DATE_FNS_PICKER_DISPLAY_FORMAT)}</span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            onSelect?.(newDate);
            setOpen(false);
          }}
          disabled={disabledMatchers}
          fromDate={minDate}
          toDate={maxDate}
          initialFocus
          modifiers={{
            range_middle: (day) => {
              if (!date || !rangeEnd) return false;
              // Support bidirectional ranges by determining start and end
              const start = date < rangeEnd ? date : rangeEnd;
              const end = date < rangeEnd ? rangeEnd : date;
              return day > start && day < end;
            },
            range_start: (day) => {
              if (!date || !rangeEnd) return false;
              const start = date < rangeEnd ? date : rangeEnd;
              return day.getTime() === start.getTime();
            },
            range_end: (day) => {
              if (!date || !rangeEnd) return false;
              const end = date < rangeEnd ? rangeEnd : date;
              return day.getTime() === end.getTime();
            },
          }}
          modifiersClassNames={{
            range_middle: 'rdp-day_range_middle',
            range_start: 'rdp-day_range_start',
            range_end: 'rdp-day_range_end',
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
