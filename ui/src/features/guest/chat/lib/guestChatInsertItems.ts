import { guestCalendarPath, guestPropertyPath } from '@/features/guest/lib/guestPublicPaths';

import { formatStayDateRange } from '@/utils/format/dates';

export type GuestChatInsertItem = {
  id: string;
  label: string;
  kind: 'text' | 'url';
  value: string;
};

export function buildGuestChatInsertItems(input: {
  propertySlug: string;
  inquiryCheckIn?: string | null;
  inquiryCheckOut?: string | null;
}): GuestChatInsertItem[] {
  const slug = input.propertySlug.trim();
  if (!slug) return [];

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const items: GuestChatInsertItem[] = [];

  const checkIn = input.inquiryCheckIn?.trim();
  const checkOut = input.inquiryCheckOut?.trim();
  if (checkIn && checkOut) {
    const range = formatStayDateRange(checkIn, checkOut);
    if (range) {
      items.push({
        id: 'share-dates',
        label: 'Share my dates',
        kind: 'text',
        value: `My stay dates: ${range}`,
      });
    }
  }

  if (origin) {
    items.push({
      id: 'calendar',
      label: 'Check availability',
      kind: 'url',
      value: `${origin}${guestCalendarPath(slug)}`,
    });
    items.push({
      id: 'property',
      label: 'View listing',
      kind: 'url',
      value: `${origin}${guestPropertyPath(slug)}`,
    });
  }

  return items;
}
