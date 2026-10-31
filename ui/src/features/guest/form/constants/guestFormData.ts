import { DEFAULT_GUEST_AGE } from '@/features/guest/form/lib/guestCounts';
import {
  GUEST_FORM_DEFAULT_CHECK_IN_TIME,
  GUEST_FORM_DEFAULT_CHECK_OUT_TIME,
} from '@/features/guest/form/lib/guestFormPropertyDefaults';
import { type GuestFormData } from '@/features/guest/form/schemas/guestFormSchema';

import {
  getDefaultDates,
  formatDateToYYYYMMDD,
  getManilaYmdToday,
  normalizeDateString,
} from '@/utils/format/dates';

const { today, tomorrow } = getDefaultDates();

export const defaultFormValues: Partial<GuestFormData> = {
  guestFacebookName: '',
  primaryGuestName: '',
  guestEmail: '',
  guestPhoneNumber: '',
  guestAddress: '',
  checkInDate: formatDateToYYYYMMDD(today),
  checkOutDate: formatDateToYYYYMMDD(tomorrow),
  checkInTime: GUEST_FORM_DEFAULT_CHECK_IN_TIME,
  checkOutTime: GUEST_FORM_DEFAULT_CHECK_OUT_TIME,
  nationality: 'Filipino',
  numberOfAdults: 1,
  numberOfChildren: 0,
  primaryGuestAge: DEFAULT_GUEST_AGE,
  guestSpecialRequests: '',
  guestRequestsSurpriseDecor: false,
  findUs: 'Facebook',
  needParking: false,
  parkingSameAsBookingDuration: true,
  hasPets: false,
  petType: 'Dog',
  petVaccinationDate: getManilaYmdToday(),
};

/**
 * Seeds check-in / check-out from `/form?checkInDate=&checkOutDate=` (calendar
 * handoff). Ignored when `bookingId` is present (existing booking load path).
 */
export function getGuestFormDefaultValuesFromSearchParams(
  sp: URLSearchParams
): Partial<GuestFormData> {
  const base: Partial<GuestFormData> = { ...defaultFormValues };
  if (sp.get('bookingId')?.trim()) return base;

  const rawIn = sp.get('checkInDate')?.trim();
  const rawOut = sp.get('checkOutDate')?.trim();
  if (!rawIn || !rawOut) return base;

  const checkInDate = normalizeDateString(rawIn);
  const checkOutDate = normalizeDateString(rawOut);
  if (checkInDate && checkOutDate) {
    base.checkInDate = checkInDate;
    base.checkOutDate = checkOutDate;
  }

  const adults = Number.parseInt(sp.get('adults') ?? '', 10);
  const children = Number.parseInt(sp.get('children') ?? '', 10);
  if (Number.isFinite(adults) && adults >= 1) base.numberOfAdults = adults;
  if (Number.isFinite(children) && children >= 0) base.numberOfChildren = children;

  return base;
}
