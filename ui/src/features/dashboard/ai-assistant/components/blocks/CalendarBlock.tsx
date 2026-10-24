import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';


type Props = Extract<ChatBlock, { type: 'calendar' }> & {
  onPageMonth?: (direction: 'prev' | 'next') => void;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

const STATE_CLASS: Record<string, string> = {
  available: 'bg-muted text-foreground',
  booked: 'bg-primary/15 text-foreground',
  blocked: 'bg-destructive/15 text-foreground',
  checkin: 'bg-primary text-primary-foreground',
  checkout: 'border-border bg-background',
};

export function CalendarBlock({ title, month, days, legend, onPageMonth }: Props) {
  if (!days.length) {
    return (
      <div className="border-border/60 space-y-2 rounded-xl border p-3">
        {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }
  const first = days[0]?.date;
  const pad = first ? new Date(`${first}T00:00:00Z`).getUTCDay() : 0;

  return (
    <div
      className="border-border/60 bg-card space-y-2 rounded-xl border p-3"
      data-testid="assistant-calendar-block"
    >
      <div className="flex items-center gap-2">
        {onPageMonth ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Previous month"
            onClick={() => onPageMonth('prev')}
          >
            ‹
          </Button>
        ) : null}
        <p className="text-foreground min-w-0 flex-1 text-center text-sm font-semibold">
          {title || month}
        </p>
        {onPageMonth ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Next month"
            onClick={() => onPageMonth('next')}
          >
            ›
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-muted-foreground text-center text-[10px] font-medium">
            {day}
          </div>
        ))}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              'flex size-9 flex-col items-center justify-center rounded-md text-[11px] tabular-nums',
              STATE_CLASS[day.state] ?? 'bg-muted'
            )}
            title={day.label || day.rate || day.state}
          >
            {Number(day.date.slice(-2))}
          </div>
        ))}
      </div>
      {legend.length > 0 ? (
        <ul className="text-muted-foreground flex flex-wrap gap-3 text-[11px]">
          {legend.map((item) => (
            <li key={item.state} className="flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-sm', STATE_CLASS[item.state] ?? 'bg-muted')} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
