import { useMemo, useState } from 'react';

import { CalendarDays, Home, Plus } from 'lucide-react';

import { buildGuestChatInsertItems } from '@/features/guest/chat/lib/guestChatInsertItems';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = {
  propertySlug: string;
  inquiryCheckIn?: string | null;
  inquiryCheckOut?: string | null;
  disabled?: boolean;
  onInsert: (value: string) => void;
};

function itemIcon(id: string) {
  if (id === 'calendar') return CalendarDays;
  if (id === 'property') return Home;
  return CalendarDays;
}

export function GuestChatInsertMenu({
  propertySlug,
  inquiryCheckIn,
  inquiryCheckOut,
  disabled,
  onInsert,
}: Props) {
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () =>
      buildGuestChatInsertItems({
        propertySlug,
        inquiryCheckIn,
        inquiryCheckOut,
      }),
    [propertySlug, inquiryCheckIn, inquiryCheckOut]
  );

  if (items.length === 0) return null;

  const handleSelect = (value: string) => {
    onInsert(value);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] shrink-0"
              disabled={disabled}
              aria-label="Insert"
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Insert</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" side="top" className="w-[min(calc(100vw-2rem),16rem)] p-1">
        {items.map((item) => {
          const Icon = itemIcon(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.value)}
              className={cn(
                'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2'
              )}
            >
              <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
