import type { ReactNode } from 'react';

import { format } from 'date-fns';
import { CalendarCheck } from 'lucide-react';

type Props = {
  selectedDay: Date | null;
  count: number;
  entityLabel: string;
  emptySelectTitle?: string;
  emptySelectCaption?: string;
  emptyDayTitle?: string;
  emptyDayCaption?: string;
  children: ReactNode;
};

export function CalendarDayDetailPanel({
  selectedDay,
  count,
  entityLabel,
  emptySelectTitle = 'Select a day',
  emptySelectCaption = 'Click any day to see items scheduled that night',
  emptyDayTitle = 'No items',
  emptyDayCaption = 'Nothing is scheduled for this night',
  children,
}: Props) {
  return (
    <div className="bg-card border-border/50 overflow-hidden rounded-xl border shadow-sm dark:shadow-none">
      <div className="border-separator bg-muted/30 border-b px-4 py-3">
        <h3 className="text-muted-foreground text-[12px] font-bold uppercase tracking-wider">
          {selectedDay ? format(selectedDay, 'EEEE, MMMM d, yyyy') : 'Day details'}
        </h3>
        {selectedDay && (
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {count === 0
              ? `No ${entityLabel} on this day`
              : `${count} ${entityLabel}${count === 1 ? '' : 's'}`}
          </p>
        )}
      </div>

      <div className="p-3">
        {!selectedDay ? (
          <CalendarEmptyDetail title={emptySelectTitle} caption={emptySelectCaption} />
        ) : count === 0 ? (
          <CalendarEmptyDetail title={emptyDayTitle} caption={emptyDayCaption} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function CalendarEmptyDetail({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <CalendarCheck className="text-muted-foreground/40 size-9" aria-hidden />
      <div>
        <p className="text-muted-foreground text-[13px] font-semibold">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{caption}</p>
      </div>
    </div>
  );
}
