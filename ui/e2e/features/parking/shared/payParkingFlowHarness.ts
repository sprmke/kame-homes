import { expect, type Page, type Route } from '@playwright/test';

import { captureParkingScreen } from './parkingScreenCapture';

export const PAY_PARKING_PROPERTY_SLUG = 'solea-mactan';
export const PAY_PARKING_BOOKING_ID = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';
export const PAY_PARKING_LINKED_REQUEST_ID = 'c3d4e5f6-a7b8-4901-c234-56789abcdef0';

export const payParkingFlowPaths = {
  guestPayParking: `/properties/${PAY_PARKING_PROPERTY_SLUG}/parking/${PAY_PARKING_BOOKING_ID}`,
  adminPayParking: `/properties/${PAY_PARKING_PROPERTY_SLUG}/parking/${PAY_PARKING_BOOKING_ID}?admin=true`,
} as const;

export type PayParkingFlowState = {
  bookingId: string;
  /** When set, legacy URL redirects to marketplace request status. */
  linkedParkingBookingId: string | null;
  /** When set (and not linked), redirects to `/parkings/in/:slug?linkStay=…`. */
  cityLocationSlug: string | null;
  /** When set (and not linked), redirects to pinned own-default form. */
  ownerDefaultParkingSlug: string | null;
};

export function createPayParkingFlowState(
  overrides: Partial<PayParkingFlowState> = {}
): PayParkingFlowState {
  return {
    bookingId: PAY_PARKING_BOOKING_ID,
    linkedParkingBookingId: null,
    cityLocationSlug: null,
    ownerDefaultParkingSlug: null,
    ...overrides,
  };
}

function payParkingBootstrap(state: PayParkingFlowState) {
  return {
    bookingId: state.bookingId,
    property_slug: PAY_PARKING_PROPERTY_SLUG,
    primary_guest_name: 'Maria Santos',
    guest_facebook_name: 'Maria Santos',
    check_in_date: '08-25-2026',
    check_out_date: '08-27-2026',
    check_in_time: '14:00',
    check_out_time: '12:00',
    number_of_nights: 2,
    number_of_adults: 2,
    number_of_children: 0,
    pax: 2,
    parking_rate_guest: null,
    parking_check_in_date: null,
    parking_check_out_date: null,
    number_of_parking_nights: null,
    car_plate_number: '',
    car_brand_model: '',
    car_color: '',
    already_submitted: false,
    status: 'PENDING_DOCUMENTS',
    email_logo_url: null,
    brand_color: '#0f766e',
    linked_parking_booking_id: state.linkedParkingBookingId,
    city_location_slug: state.cityLocationSlug,
    owner_default_parking_slug: state.ownerDefaultParkingSlug,
    owner_default_check_in: state.ownerDefaultParkingSlug ? '2026-08-25' : null,
    owner_default_check_out: state.ownerDefaultParkingSlug ? '2026-08-27' : null,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function installPayParkingFlowMocks(page: Page, state: PayParkingFlowState) {
  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'get-pay-parking':
        await fulfillJson(route, { success: true, data: payParkingBootstrap(state) });
        return;
      case 'get-guest-payment-info':
        await fulfillJson(route, {
          success: true,
          data: {
            gcashName: 'Kame Homes',
            gcashNumber: '09170000000',
            gcashQrImageUrl: '',
            paymentProvider: 'gcash',
            paymentMethods: [],
            emailLogoUrl: '',
            brandColor: '#0f766e',
            gafUnitOwner: '',
            gafTowerAndUnitNumber: '',
            gafGuestsOnsiteContactPerson: '',
            gafOwnerContactNumber: '',
            allowPets: true,
            allowParking: true,
            allowSurpriseDecor: false,
            checkInTime: '14:00',
            checkOutTime: '12:00',
            cleaningBufferMinutes: 60,
            residenceName: 'Solea Mactan',
          },
        });
        return;
      default:
        await route.continue();
    }
  });
}

/** Legacy URL → marketplace find path with `linkStay` (optional city prefix). */
export async function expectLegacyPayParkingRedirectsToFind(
  page: Page,
  state: PayParkingFlowState
) {
  await page.goto(payParkingFlowPaths.guestPayParking);
  const location = (state.cityLocationSlug ?? '').trim().toLowerCase();
  const pathPrefix =
    location && location !== 'other' ? `/parkings/in/${encodeURIComponent(location)}` : '/parkings';
  await expect(page).toHaveURL(
    new RegExp(`${pathPrefix.replace(/\//g, '\\/')}\\?.*linkStay=${state.bookingId}`)
  );
  await expect(page.getByRole('heading', { name: 'Parking request sent' })).toHaveCount(0);
  await captureParkingScreen(page, 'legacy-pay-parking-find-redirect', { role: 'guest' });
}

/** Legacy URL → existing marketplace request status when already linked. */
export async function expectLegacyPayParkingRedirectsToLinkedRequest(
  page: Page,
  state: PayParkingFlowState
) {
  const linkedId = state.linkedParkingBookingId?.trim();
  if (!linkedId) throw new Error('linkedParkingBookingId required');

  await page.goto(payParkingFlowPaths.guestPayParking);
  await expect(page).toHaveURL(new RegExp(`/parkings/requests/${linkedId}$`));
  await captureParkingScreen(page, 'legacy-pay-parking-linked-redirect', { role: 'guest' });
}
