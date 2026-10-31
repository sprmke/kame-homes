import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  hostAcceptPendingBooking,
  installParkingFlowMocks,
  parkingFlowLabels,
  parkingFlowPaths,
  parkingHostStatusLabels,
  submitGuestParkingRequest,
} from '../shared/parkingFlowHarness';
import { captureParkingScreen, setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('parking host flow', () => {
  test('host can claim a pending parking request from the dashboard', async ({ page }) => {
    setParkingScreenSuite('host-claim');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await submitGuestParkingRequest(page, { skipScreens: true });
    await page.goto(parkingFlowPaths.hostBookings);

    const bookingRow = page.getByRole('button', { name: 'Open booking for Jamie Park' }).first();
    await expect(bookingRow).toBeVisible({ timeout: 15_000 });
    await expect(bookingRow).toContainText(parkingHostStatusLabels.findingHost);
    await captureParkingScreen(page, 'host-bookings-list', { role: 'host' });

    await page.getByRole('button', { name: 'Open booking for Jamie Park' }).click();

    await expect(page.getByRole('button', { name: parkingFlowLabels.accept })).toBeVisible();
    await captureParkingScreen(page, 'host-booking-detail-pending', { role: 'host' });
    await hostAcceptPendingBooking(
      page,
      'Use the Tower 1 ramp and mention slot 12A at the guard post.'
    );

    await expect(page.getByText(parkingHostStatusLabels.awaitingPayment)).toBeVisible();
    await expect(page.getByRole('button', { name: parkingFlowLabels.accept })).toHaveCount(0);
    await expect(page.getByText(parkingHostStatusLabels.bookingAccepted)).toBeVisible();
    await captureParkingScreen(page, 'host-booking-awaiting-payment', { role: 'host' });
  });
});
