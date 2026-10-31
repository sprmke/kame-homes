import { expect, test } from '@playwright/test';

import { createParkingFlowState } from '../shared/parkingFlowHarness';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';
import {
  createPropertyBookingParkingState,
  installPropertyBookingParkingMocks,
  PROPERTY_BOOKING_ID,
  propertyBookingParkingPaths,
} from '../shared/propertyBookingParkingHarness';

async function openBookingDetailParkingActions(page: import('@playwright/test').Page) {
  await page.goto(propertyBookingParkingPaths.bookingDetail);
  await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'More actions' }).click();
}

test.describe('property booking parking panel', () => {
  test('shows linked marketplace match instead of legacy owner fields', async ({ page }) => {
    setParkingScreenSuite('property-linked-parking');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState();
    await installPropertyBookingParkingMocks(page, parkingState, propertyState);

    await page.goto(propertyBookingParkingPaths.bookingDetail);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 15_000,
    });
    await page
      .getByRole('tablist', { name: 'Booking detail sections' })
      .getByRole('tab', { name: 'Parking', exact: true })
      .click();

    const parkingPanel = page.locator('#booking-detail-full-panel');
    await expect(parkingPanel.getByText('Status')).toBeVisible();
    await expect(parkingPanel.getByText('Confirmed', { exact: true })).toBeVisible();
    await expect(parkingPanel.getByText('Host', { exact: true })).toBeVisible();
    await expect(parkingPanel.getByText('Parking Host')).toBeVisible();
    await expect(parkingPanel.getByText('host@example.com')).toBeVisible();
    await expect(parkingPanel.getByRole('button', { name: 'Endorsement copy' })).toBeVisible();
    await expect(parkingPanel.getByText('Parking owner / agent')).toHaveCount(0);
  });

  test('Find parking opens stay-scoped marketplace search when unlinked', async ({ page }) => {
    setParkingScreenSuite('property-find-parking');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    await installPropertyBookingParkingMocks(page, parkingState, propertyState);

    await openBookingDetailParkingActions(page);

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('menuitem', { name: 'Find parking' }).click();
    const popup = await popupPromise;

    await expect(popup).toHaveURL(new RegExp(`/parkings\\?.*linkStay=${PROPERTY_BOOKING_ID}`));
  });

  test('Find parking opens linked request status when already matched', async ({ page }) => {
    setParkingScreenSuite('property-find-parking-linked');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({
      linked: true,
      parkingBookingId: 'e2e-linked-parking-booking',
    });
    await installPropertyBookingParkingMocks(page, parkingState, propertyState);

    await openBookingDetailParkingActions(page);

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('menuitem', { name: 'Find parking' }).click();
    const popup = await popupPromise;

    await expect(popup).toHaveURL(/\/parkings\/requests\/e2e-linked-parking-booking$/);
  });
});
