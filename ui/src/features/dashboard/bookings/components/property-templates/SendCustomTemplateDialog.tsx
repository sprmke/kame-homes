import * as React from 'react';

import { Check, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';

import {
  bookingRowLabel,
  bookingSearchHaystack,
} from '@/features/dashboard/ai-assistant/lib/bookingPickerItems';
import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import { useSendPropertyCustomTemplateEmail } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { DEFAULT_BOOKINGS_QUERY, type BookingRow } from '@/features/dashboard/bookings/lib/types';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

type Props = {
  templateKey: string;
  templateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SendCustomTemplateDialog({ templateKey, templateName, open, onOpenChange }: Props) {
  const [query, setQuery] = React.useState('');
  const [selectedBooking, setSelectedBooking] = React.useState<BookingRow | null>(null);
  const { data, isLoading } = useBookings(
    { ...DEFAULT_BOOKINGS_QUERY, bookingKind: 'property', sort: 'check_in_date:desc', limit: 80 },
    { scope: 'property' }
  );
  const send = useSendPropertyCustomTemplateEmail();

  const rows = data?.rows ?? [];
  const trimmedQuery = query.trim().toLowerCase();
  const filteredRows = trimmedQuery
    ? rows.filter((row) => bookingSearchHaystack(row).toLowerCase().includes(trimmedQuery))
    : rows;

  const reset = () => {
    setQuery('');
    setSelectedBooking(null);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const handleSend = () => {
    if (!selectedBooking) return;
    send.mutate(
      { bookingId: selectedBooking.id, templateKey },
      {
        onSuccess: () => {
          toast.success(`Sent to ${bookingRowLabel(selectedBooking)}`);
          handleOpenChange(false);
        },
        onError: (error) => {
          toast.error(friendlyToastError(error, 'Could not send template'));
        },
      }
    );
  };

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent className="flex max-h-[min(85dvh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[28rem]">
        <ResponsiveModalHeader className="border-border/60 shrink-0 border-b px-4 py-3 sm:px-5">
          <ResponsiveModalTitle className="pr-8">
            Send &ldquo;{templateName}&rdquo;
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Pick a booking to email this template to.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <Command shouldFilter={false} className="min-h-0 flex-1">
          <CommandInput
            placeholder="Guest, date, or status"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-none flex-1">
            {!isLoading && filteredRows.length === 0 ? (
              <CommandEmpty>No bookings</CommandEmpty>
            ) : null}
            <CommandGroup>
              {filteredRows.map((row) => (
                <CommandItem
                  key={row.id}
                  value={row.id}
                  onSelect={() => setSelectedBooking(row)}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      selectedBooking?.id === row.id ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{bookingRowLabel(row)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <ResponsiveModalFooter className="border-border/60 shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedBooking || send.isPending}
            onClick={handleSend}
            className="gap-2"
          >
            {send.isPending ? (
              <Mail className="size-4 shrink-0 animate-pulse" aria-hidden />
            ) : (
              <Send className="size-4 shrink-0" aria-hidden />
            )}
            {send.isPending ? 'Sending…' : 'Send'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
