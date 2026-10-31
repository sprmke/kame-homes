import { formatDateForEmail } from './utils.ts';
import {
  loadPropertyEmailBranding,
  resolveEmailUnitLabel,
  type PropertyEmailBranding,
} from './propertyEmailBranding.ts';

export type BookingEmailDateFields = {
  tower_and_unit_number?: string | null;
  check_in_date: string;
  check_out_date: string;
};

export type BookingEmailDisplayContext = {
  branding: PropertyEmailBranding;
  unitLabel: string;
  displayCheckInDate: string;
  displayCheckOutDate: string;
};

export async function loadBookingEmailDisplayContext(
  propertyId: string | null | undefined,
  booking: BookingEmailDateFields
): Promise<BookingEmailDisplayContext> {
  const branding = await loadPropertyEmailBranding(propertyId);
  return {
    branding,
    unitLabel: resolveEmailUnitLabel(booking.tower_and_unit_number, branding),
    displayCheckInDate: formatDateForEmail(booking.check_in_date),
    displayCheckOutDate: formatDateForEmail(booking.check_out_date),
  };
}
