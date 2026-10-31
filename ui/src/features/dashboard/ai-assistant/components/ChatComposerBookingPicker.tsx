import { CalendarDays } from 'lucide-react';

import { ChatComposerBookingRow } from '@/features/dashboard/ai-assistant/components/ChatComposerBookingRow';
import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import { ChatComposerPickerTrigger } from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import {
  bookingRowLabel,
  bookingSearchHaystack,
  groupByCheckInMonth,
} from '@/features/dashboard/ai-assistant/lib/bookingPickerItems';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import { DEFAULT_BOOKINGS_QUERY, type BookingRow } from '@/features/dashboard/bookings/lib/types';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

type Props = ComposerPickerSharedProps & {
  pageBookingId?: string | null;
};

export function ChatComposerBookingPicker({
  selectedIds,
  onSelect,
  pageBookingId,
  pageEntityId,
  disabled,
  overlayContainer,
}: Props) {
  const propertyId = usePropertyIdParam();
  const pinToTopId = pageBookingId ?? pageEntityId;
  const { data, isLoading } = useBookings(
    {
      ...DEFAULT_BOOKINGS_QUERY,
      bookingKind: 'property',
      sort: 'check_in_date:asc',
      limit: 80,
    },
    { scope: propertyId ? 'property' : 'org' }
  );

  const rows = data?.rows ?? [];

  const selectRow = (row: BookingRow) => {
    onSelect({
      type: 'booking',
      id: row.id,
      propertyId: row.property_id ?? null,
      label: bookingRowLabel(row),
    });
  };

  return (
    <ChatComposerContextPicker
      items={rows}
      getItemId={(row) => row.id}
      searchHaystack={bookingSearchHaystack}
      groupBy={groupByCheckInMonth}
      pageEntityId={pinToTopId}
      renderRow={(row, { selected, hint, onSelect: pick }) => (
        <ChatComposerBookingRow row={row} selected={selected} hint={hint} onSelect={pick} />
      )}
      selectedIds={selectedIds}
      onSelect={selectRow}
      searchPlaceholder="Guest, date, or status"
      searchAriaLabel="Search bookings"
      listAriaLabel="Bookings"
      emptyLabel="No bookings"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={CalendarDays}
          label="Pin a booking"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
