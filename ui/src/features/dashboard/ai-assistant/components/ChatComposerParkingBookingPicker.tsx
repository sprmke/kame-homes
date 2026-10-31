import { ParkingSquare } from 'lucide-react';

import { ChatComposerBookingRow } from '@/features/dashboard/ai-assistant/components/ChatComposerBookingRow';
import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import { ChatComposerPickerTrigger } from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import {
  bookingRowLabel,
  bookingSearchHaystack,
  groupByCheckInMonth,
} from '@/features/dashboard/ai-assistant/lib/bookingPickerItems';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { DEFAULT_BOOKINGS_QUERY, type BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useParkingBookings } from '@/features/dashboard/parking/hooks/useParkingBookings';

export function ChatComposerParkingBookingPicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const { data, isLoading } = useParkingBookings({
    ...DEFAULT_BOOKINGS_QUERY,
    sort: 'check_in_date:asc',
    limit: 80,
  });
  const rows = data?.rows ?? [];

  const selectRow = (row: BookingRow) => {
    onSelect({
      type: 'parking_booking',
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
      pageEntityId={pageEntityId}
      renderRow={(row, { selected, hint, onSelect: pick }) => (
        <ChatComposerBookingRow row={row} selected={selected} hint={hint} onSelect={pick} />
      )}
      selectedIds={selectedIds}
      onSelect={selectRow}
      searchPlaceholder="Guest, date, or status"
      searchAriaLabel="Search parking bookings"
      listAriaLabel="Parking bookings"
      emptyLabel="No bookings"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={ParkingSquare}
          label="Pin a parking booking"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
