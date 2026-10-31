import * as React from 'react';

import { Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const TIME_STEP_MINUTES = 30;

function formatTimeLabel(value: string): string {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function buildTimeOptions(value?: string): string[] {
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += TIME_STEP_MINUTES) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  // Preserve an off-grid saved value (e.g. a legacy `14:15`) instead of losing it.
  if (value && !options.includes(value)) {
    options.push(value);
    options.sort();
  }
  return options;
}

interface TimePickerProps {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Return true to gray out and block selecting a given `HH:mm` option. */
  disabledTime?: (value: string) => boolean;
  placeholder?: string;
  className?: string;
  'aria-invalid'?: boolean;
}

export function TimePicker({
  id,
  value,
  onChange,
  disabled,
  disabledTime,
  placeholder = 'Select time',
  className,
  ['aria-invalid']: ariaInvalid,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const options = React.useMemo(() => buildTimeOptions(value), [value]);
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) {
      selectedRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          type="button"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            'h-10 w-full justify-start rounded-lg px-3 py-2 text-left font-normal',
            !value ? 'text-muted-foreground' : 'text-foreground',
            ariaInvalid && 'border-destructive',
            className
          )}
        >
          <Clock
            className={cn(
              'mr-2 h-4 w-4 flex-shrink-0',
              !value ? 'text-muted-foreground' : 'text-foreground'
            )}
            aria-hidden
          />
          <span className="truncate">{value ? formatTimeLabel(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-64 w-40 overflow-y-auto p-1" align="start">
        {options.map((option) => {
          const isSelected = option === value;
          const isDisabled = disabledTime?.(option) ?? false;
          return (
            <Button
              key={option}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              variant={isSelected ? 'secondary' : 'ghost'}
              disabled={isDisabled}
              className="w-full justify-start px-2 font-normal"
              onClick={() => {
                onChange?.(option);
                setOpen(false);
              }}
            >
              {formatTimeLabel(option)}
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
