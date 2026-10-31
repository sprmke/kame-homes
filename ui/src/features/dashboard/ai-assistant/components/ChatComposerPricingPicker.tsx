import { useMemo, useState } from 'react';

import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

import { ChatComposerPickerTrigger } from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import { useChatComposerSearchAll } from '@/features/dashboard/ai-assistant/components/ChatComposerSearchAllContext';
import { ChatComposerSearchAllRow } from '@/features/dashboard/ai-assistant/components/ChatComposerSearchAllRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';

import { Calendar as DayCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function ChatComposerPricingPicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
}: ComposerPickerSharedProps) {
  const [open, setOpen] = useState(false);
  const onSearchAll = useChatComposerSearchAll();
  const pinnedDates = useMemo(
    () =>
      [...selectedIds]
        .map((id) => {
          const [year, month, day] = id.split('-').map(Number);
          if (!year || !month || !day) return null;
          return new Date(year, month - 1, day);
        })
        .filter((value): value is Date => value instanceof Date),
    [selectedIds]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ChatComposerPickerTrigger
          icon={Calendar}
          label="Pin a date"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        container={overlayContainer}
        className="w-auto p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onWheel={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DayCalendar
          mode="single"
          selected={undefined}
          onSelect={(date) => {
            if (!date) return;
            const id = format(date, 'yyyy-MM-dd');
            onSelect({
              type: 'pricing_date',
              id,
              label: format(date, 'MMM d, yyyy'),
            });
            setOpen(false);
          }}
          modifiers={{ pinned: pinnedDates }}
          modifiersClassNames={{ pinned: 'bg-primary/10' }}
          className={cn(
            'p-2',
            '[&_.rdp-day_button]:min-h-[44px] [&_.rdp-day_button]:min-w-[44px]',
            '[&_.rdp-button_previous]:min-h-[44px] [&_.rdp-button_previous]:min-w-[44px]',
            '[&_.rdp-button_next]:min-h-[44px] [&_.rdp-button_next]:min-w-[44px]'
          )}
        />
        {onSearchAll ? (
          <div className="border-border/60 border-t p-1.5">
            <ChatComposerSearchAllRow
              onClick={() => {
                setOpen(false);
                onSearchAll();
              }}
            />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
