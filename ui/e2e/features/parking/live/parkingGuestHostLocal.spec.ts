import { expect, test } from '@playwright/test';

import { parkingGuestStatusLabels, parkingHostStatusLabels } from '../shared/parkingFlowHarness';
import {
  buildLiveParkingHostBookingsPath,
  cleanupLiveParkingBookings,
  createLiveParkingGuestSeed,
  installLocalParkingHostSession,
  liveParkingFlowLabels,
  signInLocalParkingHost,
  submitLiveGuestParkingRequest,
} from '../shared/parkingLiveLocalHarness';
import { captureParkingScreen, setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('@live parking live local flow', () => {
  test('guest submission and host acceptance work against local Supabase', async ({
    browser,
    page,
    request,
  }, testInfo) => {
    setParkingScreenSuite('live-local');
    test.skip(
      !process.env.PLAYWRIGHT_LOCAL_LIVE,
      'Set PLAYWRIGHT_LOCAL_LIVE=1 and run against the local Supabase stack.'
    );
    test.skip(
      testInfo.project.name !== 'chromium',
      'Run the local stack scenario with the chromium project.'
    );
    test.setTimeout(90_000);

    const seed = createLiveParkingGuestSeed();
    const hostSession = await signInLocalParkingHost(request);

    await cleanupLiveParkingBookings(request, seed.guestEmail);

    const hostContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const hostPage = await hostContext.newPage();

    try {
      await installLocalParkingHostSession(hostPage, hostSession);

      await submitLiveGuestParkingRequest(page, seed);
      await expect(
        page.getByRole('heading', { name: parkingGuestStatusLabels.findingHost })
      ).toBeVisible();
      await captureParkingScreen(page, 'guest-waiting-final', { role: 'guest' });

      await hostPage.goto(buildLiveParkingHostBookingsPath(seed));
      const bookingRow = hostPage.getByRole('button', {
        name: `Open booking for ${seed.guestName}`,
      });
      await expect(bookingRow.first()).toBeVisible();
      await captureParkingScreen(hostPage, 'host-bookings-list', { role: 'host' });
      await bookingRow.first().click();
      await captureParkingScreen(hostPage, 'host-booking-detail-pending', { role: 'host' });

      await hostPage
        .getByLabel(liveParkingFlowLabels.accessInstructions)
        .fill(seed.endorsementNote);
      await hostPage.getByRole('button', { name: liveParkingFlowLabels.accept }).click();

      await expect(hostPage.getByText(parkingHostStatusLabels.awaitingPayment)).toBeVisible();
      await captureParkingScreen(hostPage, 'host-booking-awaiting-payment', { role: 'host' });

      await page.reload();
      await expect(
        page.getByRole('heading', { name: parkingGuestStatusLabels.payToConfirm })
      ).toBeVisible();
      await expect(page.getByText(parkingGuestStatusLabels.payDetail)).toBeVisible();
      await expect(page.getByText(parkingGuestStatusLabels.nonRefundable)).toBeVisible();
      await captureParkingScreen(page, 'guest-awaiting-payment-final', { role: 'guest' });
    } finally {
      await cleanupLiveParkingBookings(request, seed.guestEmail);
      await hostContext.close();
    }
  });
});
