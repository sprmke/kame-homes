import * as React from 'react';

import { startOfDay } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  DATE_PICKER_DISPLAY_FORMAT,
  dateToString,
  formatIsoDateForDisplay,
  stringToDate,
} from '@/utils/format/dates';

export interface IsoDateInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  className?: string;
  wrapperClassName?: string;
  'aria-label'?: string;
}

function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso?.match(/^\d{4}-\d{2}-\d{2}$/)) return undefined;
  try {
    return stringToDate(iso);
  } catch {
    return undefined;
  }
}

function emitIsoChange(
  onChange: IsoDateInputProps['onChange'],
  name: string | undefined,
  iso: string
) {
  onChange?.({
    target: { value: iso, name: name ?? '' },
    currentTarget: { value: iso, name: name ?? '' },
  } as React.ChangeEvent<HTMLInputElement>);
}

/**
 * ISO date field (`YYYY-MM-DD` value) that always displays `MM/DD/YYYY`.
 * Uses the shared calendar popover — full field is clickable (unlike native
 * `type="date"` overlays where only the calendar icon receives clicks).
 */
const IsoDateInput = React.forwardRef<HTMLButtonElement, IsoDateInputProps>(
  (
    {
      className,
      wrapperClassName,
      value,
      defaultValue,
      disabled,
      id,
      name,
      min,
      max,
      onChange,
      onBlur,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const isControlled = value !== undefined;
    const [internalIso, setInternalIso] = React.useState(() => {
      if (typeof value === 'string') return value;
      if (typeof defaultValue === 'string') return defaultValue;
      return '';
    });

    React.useEffect(() => {
      if (isControlled) {
        setInternalIso(typeof value === 'string' ? value : '');
      }
    }, [isControlled, value]);

    const isoValue = isControlled ? (typeof value === 'string' ? value : '') : internalIso;
    const selectedDate = isoToDate(isoValue);
    const minDate = isoToDate(min);
    const maxDate = isoToDate(max);
    const display = formatIsoDateForDisplay(isoValue);

    const handleSelect = (date: Date | undefined) => {
      const nextIso = date ? dateToString(date) : '';
      if (!isControlled) {
        setInternalIso(nextIso);
      }
      emitIsoChange(onChange, name, nextIso);
      setOpen(false);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            id={id}
            name={name}
            disabled={disabled}
            aria-label={ariaLabel ?? 'Date'}
            aria-haspopup="dialog"
            aria-expanded={open}
            onBlur={onBlur}
            className={cn(
              'border-input bg-card field-focus relative flex h-10 w-full items-center rounded-lg border pl-3 pr-10 text-left text-sm transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              display ? 'text-foreground' : 'text-muted-foreground',
              wrapperClassName,
              className
            )}
          >
            <span className="truncate">{display || DATE_PICKER_DISPLAY_FORMAT}</span>
            <CalendarIcon
              className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            fromDate={minDate}
            toDate={maxDate}
            disabled={[
              ...(minDate ? [{ before: startOfDay(minDate) }] : []),
              ...(maxDate ? [{ after: startOfDay(maxDate) }] : []),
            ]}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }
);
IsoDateInput.displayName = 'IsoDateInput';

export { IsoDateInput };
