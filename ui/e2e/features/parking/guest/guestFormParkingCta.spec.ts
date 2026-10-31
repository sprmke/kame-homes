import { expect, test, type Page } from '@playwright/test';

import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

const GUEST_FORM_SUCCESS_BOOKING = {
  checkInDate: '2026-08-25',
  checkOutDate: '2026-08-27',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  numberOfAdults: 2,
  numberOfChildren: 0,
  primaryGuestName: 'Maria Santos',
  needParking: true,
  guestEmail: 'maria@example.com',
  guestPhoneNumber: '09171234567',
  hasPets: false,
};

async function installGuestFormSuccessMocks(page: Page) {
  await page.route('**/functions/v1/get-guest-payment-info**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
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
          organizationName: 'Kame Homes PH',
        },
      }),
    });
  });
}

/** React Router 6 stores `location.state` on `history.state.usr`. */
async function openGuestFormSuccessWithState(page: Page) {
  const path = '/properties/solea-mactan/success?bookingId=property-booking-success-001';

  await page.goto('/');
  await page.evaluate(
    ({ path, bookingData }) => {
      window.history.replaceState({ usr: { bookingData } }, '', path);
    },
    { path, bookingData: GUEST_FORM_SUCCESS_BOOKING }
  );
  await page.reload();
}

test.describe('guest form parking CTA', () => {
  test('shows marketplace link after submit when guest needs parking', async ({ page }) => {
    setParkingScreenSuite('guest-form-parking-cta');
    await installGuestFormSuccessMocks(page);
    await openGuestFormSuccessWithState(page);

    await expect(page.getByText('Need parking?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find parking near your stay' })).toHaveAttribute(
      'href',
      '/parkings'
    );
  });
});
