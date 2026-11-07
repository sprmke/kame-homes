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
  test('host can claim a pending parking request from the dashboard', async ({
    page,
    browser,
  }) => {
    setParkingScreenSuite('host-claim');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await submitGuestParkingRequest(page, { skipScreens: true });

    // A fresh host context avoids restoring the guest page's persisted query cache.
    const hostContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const hostPage = await hostContext.newPage();
    try {
      await installParkingFlowMocks(hostPage, state);
      await hostPage.goto(parkingFlowPaths.hostBookings);

      const bookingRow = hostPage
        .getByRole('button', { name: 'Open booking for Jamie Park' })
        .first();
      await expect(bookingRow).toBeVisible({ timeout: 15_000 });
      await expect(bookingRow).toContainText(parkingHostStatusLabels.findingHost);
      await captureParkingScreen(hostPage, 'host-bookings-list', { role: 'host' });

      await hostPage.getByRole('button', { name: 'Open booking for Jamie Park' }).click();

      await expect(
        hostPage.getByRole('button', { name: parkingFlowLabels.accept })
      ).toBeVisible();
      await expect(hostPage.getByText('jamie@example.com')).toBeVisible();
      await expect(hostPage.getByText('09171234567')).toBeVisible();
      await expect(hostPage.getByText('ABC-1234')).toBeVisible();
      await expect(hostPage.getByText('Toyota Vios · Gray')).toBeVisible();
      await captureParkingScreen(hostPage, 'host-booking-detail-pending', { role: 'host' });
      await hostAcceptPendingBooking(
        hostPage,
        'Use the Tower 1 ramp and mention slot 12A at the guard post.'
      );

      await expect(
        hostPage.getByText(parkingHostStatusLabels.awaitingPayment).first()
      ).toBeVisible();
      await expect(
        hostPage.getByRole('button', { name: parkingFlowLabels.accept })
      ).toHaveCount(0);
      await expect(hostPage.getByText(parkingHostStatusLabels.bookingAccepted)).toBeVisible();
      await captureParkingScreen(hostPage, 'host-booking-awaiting-payment', { role: 'host' });
    } finally {
      await hostContext.close();
    }
  });
});
