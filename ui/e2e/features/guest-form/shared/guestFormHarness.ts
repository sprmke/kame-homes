import { mockEdgeFunctions } from '../../../shared/interceptEdge';

import type { Page } from '@playwright/test';

function manilaTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function addDaysYmd(ymd: string, days: number): string {
  const noonManila = new Date(`${ymd}T12:00:00+08:00`);
  noonManila.setUTCDate(noonManila.getUTCDate() + days);
  return noonManila.toISOString().slice(0, 10);
}

/** Future stay window so CI does not fail when URL dates drift into the past (Manila calendar). */
function defaultStayQueryParams(): { checkInDate: string; checkOutDate: string } {
  const today = manilaTodayYmd();
  const checkInDate = addDaysYmd(today, 14);
  const checkOutDate = addDaysYmd(today, 16);
  return { checkInDate, checkOutDate };
}

export const GUEST_FORM_PROPERTY_SLUG = 'solea-mactan';

type GuestFormMockOptions = {
  allowPets?: boolean;
  allowParking?: boolean;
  bookedDates?: string[];
};

export async function installGuestFormMocks(page: Page, options: GuestFormMockOptions = {}) {
  const allowPets = options.allowPets ?? false;
  const allowParking = options.allowParking ?? false;

  await mockEdgeFunctions(page, [
    {
      name: 'get-guest-payment-info',
      body: {
        success: true,
        data: {
          gcashName: 'Kame Homes',
          gcashNumber: '09170000000',
          gcashQrImageUrl: '',
          paymentProvider: 'gcash',
          paymentMethods: [],
          emailLogoUrl: '',
          brandColor: '#0f766e',
          gafUnitOwner: 'Unit Owner',
          gafTowerAndUnitNumber: 'Tower 1 / 1204',
          gafGuestsOnsiteContactPerson: 'On-site Contact',
          gafOwnerContactNumber: '09171234567',
          allowPets,
          allowParking,
          allowSurpriseDecor: false,
          checkInTime: '14:00',
          checkOutTime: '12:00',
          cleaningBufferMinutes: 60,
          maxAdults: 4,
          maxChildren: 2,
          propertyName: 'Solea Mactan',
          propertyEyebrow: 'Kame Homes PH',
          propertyCoverImageUrl: null,
          residenceName: 'Solea Residences',
          organizationName: 'Kame Homes PH',
          defaultParkingRateGuest: 400,
          petFee: 300,
        },
      },
    },
    {
      name: 'get-booked-dates',
      body: { success: true, data: { bookedDates: options.bookedDates ?? [] } },
    },
    {
      name: 'submit-form',
      method: 'POST',
      body: { success: true, bookingId: 'guest-form-e2e-booking-001' },
    },
  ]);
}

export function guestFormPath(extraQuery = '') {
  const { checkInDate, checkOutDate } = defaultStayQueryParams();
  const base = `/properties/${GUEST_FORM_PROPERTY_SLUG}/form?checkInDate=${checkInDate}&checkOutDate=${checkOutDate}`;
  return extraQuery ? `${base}&${extraQuery}` : base;
}

export function guestCalendarPath() {
  return `/properties/${GUEST_FORM_PROPERTY_SLUG}/calendar`;
}
