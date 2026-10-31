import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  guestPayForParking,
  hostAcceptPendingBooking,
  installParkingFlowMocks,
  parkingFlowLabels,
  parkingFlowPaths,
  parkingGuestStatusLabels,
  parkingHostStatusLabels,
  submitGuestParkingRequest,
} from '../shared/parkingFlowHarness';
import { captureParkingScreen, setParkingScreenSuite } from '../shared/parkingScreenCapture';
import {
  closeParkingSideBySideBrowsers,
  demoPause,
  launchParkingSideBySideBrowsers,
  sideBySideTimeoutMs,
} from '../shared/parkingSideBySideHelpers';

test.describe('parking guest and host side by side', () => {
  test('full marketplace flow: submit, accept, pay, confirm, and complete', async ({
    page: _page,
  }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    setParkingScreenSuite('side-by-side-full');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage);
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.findingHost })
      ).toBeVisible();
      await expect(guestPage.getByText(parkingGuestStatusLabels.searchingNearby)).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-waiting', { role: 'guest' });
      await demoPause(guestPage, hostPage);

      if (process.env.PLAYWRIGHT_INSPECT === '1') {
        await guestPage.pause();
      }

      await hostPage.goto(parkingFlowPaths.hostBookings);
      const bookingRow = hostPage.getByRole('button', { name: 'Open booking for Jamie Park' });
      await expect(bookingRow).toBeVisible();
      await expect(bookingRow).toContainText(parkingHostStatusLabels.findingHost);
      await captureParkingScreen(hostPage, 'host-bookings-list', { role: 'host' });
      await demoPause(hostPage);
      await bookingRow.click();
      await captureParkingScreen(hostPage, 'host-booking-detail-pending', { role: 'host' });
      await demoPause(hostPage);

      await hostAcceptPendingBooking(hostPage);
      await expect(hostPage.getByText(parkingHostStatusLabels.awaitingPayment)).toBeVisible();
      await expect(hostPage.getByText(parkingHostStatusLabels.bookingAccepted)).toBeVisible();
      await captureParkingScreen(hostPage, 'host-booking-awaiting-payment', { role: 'host' });
      await demoPause(hostPage, guestPage);

      await guestPage.reload();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.payToConfirm })
      ).toBeVisible();
      await expect(guestPage.getByText(parkingGuestStatusLabels.payDetail)).toBeVisible();
      await expect(
        guestPage.getByText(parkingGuestStatusLabels.assignedSlot, { exact: true })
      ).toBeVisible();
      await expect(guestPage.getByText(parkingGuestStatusLabels.nonRefundable)).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-awaiting-payment', { role: 'guest' });
      await demoPause(guestPage);

      await guestPayForParking(guestPage, state);
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.parkingConfirmed })
      ).toBeVisible();
      await expect(
        guestPage.getByText('Use the Tower 1 ramp and show this request at the guard.')
      ).toBeVisible();
      await guestPage
        .getByRole('button', { name: parkingGuestStatusLabels.hostAndEndorsement })
        .click();
      await expect(
        guestPage.getByRole('button', { name: parkingGuestStatusLabels.chatWithHost })
      ).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-paid-confirmed', { role: 'guest' });
      await demoPause(guestPage, hostPage);

      await hostPage.reload();
      await expect(hostPage.getByText(parkingHostStatusLabels.pendingReview)).toBeVisible({
        timeout: 15_000,
      });
      await captureParkingScreen(hostPage, 'host-pending-review', { role: 'host' });
      await demoPause(hostPage);

      await hostPage.getByRole('button', { name: parkingFlowLabels.markReady }).click();
      await expect(hostPage.getByText(parkingHostStatusLabels.readyForCheckin)).toBeVisible();
      await captureParkingScreen(hostPage, 'host-ready-for-checkin', { role: 'host' });
      await demoPause(hostPage);

      await hostPage.getByRole('button', { name: parkingFlowLabels.complete }).click();
      await expect(hostPage.getByText(parkingHostStatusLabels.completed)).toBeVisible();
      await captureParkingScreen(hostPage, 'host-completed', { role: 'host' });
      await captureParkingScreen(guestPage, 'guest-paid-final', { role: 'guest' });
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });

  test('host decline closes the guest request', async ({ page: _page }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    setParkingScreenSuite('side-by-side-decline');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage, { skipScreens: true });
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.findingHost })
      ).toBeVisible();

      await hostPage.goto(parkingFlowPaths.hostBookings);
      await hostPage.getByRole('button', { name: 'Open booking for Jamie Park' }).click();
      await hostPage.getByRole('button', { name: parkingFlowLabels.decline }).click();
      await expect(hostPage.getByText('Request declined')).toBeVisible();
      await captureParkingScreen(hostPage, 'host-declined', { role: 'host' });

      await guestPage.reload();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.noHostAvailable })
      ).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-no-host', { role: 'guest' });
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });

  test('guest can cancel while awaiting payment after host accept', async ({
    page: _page,
  }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    setParkingScreenSuite('side-by-side-cancel-payment');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage, { skipScreens: true });
      await hostPage.goto(parkingFlowPaths.hostBookings);
      await hostPage.getByRole('button', { name: 'Open booking for Jamie Park' }).click();
      await hostAcceptPendingBooking(hostPage);

      await guestPage.reload();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.payToConfirm })
      ).toBeVisible();
      await guestPage.getByRole('button', { name: parkingFlowLabels.cancelRequest }).click();
      await guestPage
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Cancel request' })
        .click();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.requestCancelled })
      ).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-cancelled-after-accept', { role: 'guest' });
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });

  test('direct booking link and host pricing card are wired', async ({ page: _page }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    setParkingScreenSuite('side-by-side-direct-link');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await hostPage.goto(parkingFlowPaths.hostPricing);
      await expect(hostPage.getByText('Direct booking link')).toBeVisible();
      await expect(hostPage.getByRole('button', { name: 'Copy link' })).toBeVisible();
      await captureParkingScreen(hostPage, 'host-pricing-direct-link', { role: 'host' });

      await submitGuestParkingRequest(guestPage, {
        formPath: parkingFlowPaths.guestDirectLinkForm,
        skipScreens: true,
      });
      expect(state.bookingChannel).toBe('direct_link');
      expect(state.lastSubmitBody?.directLinkToken).toBeTruthy();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.findingHost })
      ).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-direct-link-submitted', { role: 'guest' });
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });
});
