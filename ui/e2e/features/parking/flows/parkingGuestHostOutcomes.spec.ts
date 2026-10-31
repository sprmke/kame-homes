import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  installParkingFlowMocks,
  markParkingFlowUnavailable,
  parkingFlowLabels,
  parkingFlowPaths,
  parkingGuestStatusLabels,
  submitGuestParkingRequest,
} from '../shared/parkingFlowHarness';
import { captureParkingScreen, setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('@ci parking guest and host outcomes', () => {
  test('guest sees a no-host-available state when the request expires', async ({ page }) => {
    setParkingScreenSuite('outcome-expired');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await submitGuestParkingRequest(page, { skipScreens: true });
    markParkingFlowUnavailable(state, 'expired');
    await page.goto(parkingFlowPaths.guestStatus);

    await expect(
      page.getByRole('heading', { name: parkingGuestStatusLabels.noHostAvailable })
    ).toBeVisible();
    await expect(page.getByText('Try different dates or another listing.')).toBeVisible();
    await captureParkingScreen(page, 'guest-no-host-expired', { role: 'guest' });
  });

  test('guest sees a no-host-available state when the backend already closed the request', async ({
    page,
  }) => {
    setParkingScreenSuite('outcome-closed-backend');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await submitGuestParkingRequest(page, { skipScreens: true });
    state.status = 'NO_HOST_AVAILABLE';
    state.broadcastResponse = 'declined';
    await page.goto(parkingFlowPaths.guestStatus);

    await expect(
      page.getByRole('heading', { name: parkingGuestStatusLabels.noHostAvailable })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse parking' })).toBeVisible();
    await captureParkingScreen(page, 'guest-no-host-closed', { role: 'guest' });
  });

  test('host can decline a pending request and the guest sees the request close out', async ({
    page,
  }) => {
    setParkingScreenSuite('outcome-decline');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await submitGuestParkingRequest(page, { skipScreens: true });
    await page.goto(parkingFlowPaths.hostBookings);
    await captureParkingScreen(page, 'host-bookings-list', { role: 'host' });
    await page.getByRole('button', { name: 'Open booking for Jamie Park' }).click();
    await captureParkingScreen(page, 'host-booking-detail-pending', { role: 'host' });
    await page.getByRole('button', { name: parkingFlowLabels.decline }).click();

    await expect(page.getByText('No host')).toBeVisible();
    await expect(page.getByText('Request declined')).toBeVisible();
    await captureParkingScreen(page, 'host-booking-declined', { role: 'host' });

    await page.goto(parkingFlowPaths.guestStatus);
    await expect(
      page.getByRole('heading', { name: parkingGuestStatusLabels.noHostAvailable })
    ).toBeVisible();
    await captureParkingScreen(page, 'guest-no-host-after-decline', { role: 'guest' });
  });

  test('guest can cancel while still searching for a host', async ({ page }) => {
    setParkingScreenSuite('outcome-cancel-searching');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await submitGuestParkingRequest(page, { skipScreens: true });
    await page.getByRole('button', { name: parkingFlowLabels.cancelRequest }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel request' }).click();

    await expect(
      page.getByRole('heading', { name: parkingGuestStatusLabels.requestCancelled })
    ).toBeVisible();
    await captureParkingScreen(page, 'guest-cancelled-searching', { role: 'guest' });
  });
});
