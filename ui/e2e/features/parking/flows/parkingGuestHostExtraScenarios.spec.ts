import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  expireParkingPaymentAndResumeSearch,
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

async function openHostListFresh(page: import('@playwright/test').Page) {
  const listResponse = page.waitForResponse(
    (response) => response.url().includes('/functions/v1/list-bookings') && response.ok()
  );
  await page.goto(parkingFlowPaths.hostBookings);
  await listResponse;
  const bookingRow = page.getByRole('button', { name: 'Open booking for Jamie Park' });
  await expect(bookingRow).toBeVisible({ timeout: 15_000 });
  return bookingRow;
}

async function openHostBooking(page: import('@playwright/test').Page) {
  const bookingRow = await openHostListFresh(page);
  await bookingRow.click();
}

test.describe('parking guest and host extra scenarios', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Side-by-side uses Chromium.');

  test('auto-accept claims the top match without a host click', async ({ page: _page }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    state.autoAcceptTopMatch = true;
    setParkingScreenSuite('side-by-side-auto-accept');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage, { skipScreens: true });

      // No host interaction: the request lands directly in pay-to-confirm.
      expect(state.status).toBe('PENDING_PAYMENT');
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.payToConfirm })
      ).toBeVisible();
      await expect(guestPage.getByText(parkingGuestStatusLabels.payDetail)).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-auto-accepted', { role: 'guest' });
      await demoPause(guestPage, hostPage);

      await openHostBooking(hostPage);
      await expect(hostPage.getByText(parkingHostStatusLabels.awaitingPayment).first()).toBeVisible();
      await expect(hostPage.getByRole('button', { name: parkingFlowLabels.accept })).toHaveCount(0);
      await captureParkingScreen(hostPage, 'host-auto-accepted', { role: 'host' });
      await demoPause(hostPage);

      await guestPayForParking(guestPage, state);
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.parkingConfirmed })
      ).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-auto-accept-paid', { role: 'guest' });
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });

  test('free parking on the host own slot confirms without payment', async ({
    page: _page,
  }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    state.complimentaryOwnerParking = true;
    setParkingScreenSuite('side-by-side-free-own-slot');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage, { linkedStay: true, skipScreens: true });

      expect(state.status).toBe('PENDING_REVIEW');
      expect(state.linkedPropertyBookingId).toBeTruthy();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.parkingConfirmed })
      ).toBeVisible();
      await expect(guestPage.getByRole('button', { name: parkingFlowLabels.payNow })).toHaveCount(0);
      await expect(guestPage.getByText(parkingGuestStatusLabels.nonRefundable)).toHaveCount(0);
      await captureParkingScreen(guestPage, 'guest-free-own-slot', { role: 'guest' });
      await demoPause(guestPage, hostPage);

      await openHostBooking(hostPage);
      await expect(hostPage.getByText(parkingHostStatusLabels.pendingReview).first()).toBeVisible();
      await expect(hostPage.getByText(parkingHostStatusLabels.awaitingPayment)).toHaveCount(0);
      await captureParkingScreen(hostPage, 'host-free-own-slot', { role: 'host' });
      await demoPause(hostPage);
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });

  test('payment window expiry resumes the search and the host can accept again', async ({
    page: _page,
  }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    setParkingScreenSuite('side-by-side-payment-expiry');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage, { skipScreens: true });
      await openHostBooking(hostPage);
      await hostAcceptPendingBooking(hostPage);

      await guestPage.reload();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.payToConfirm })
      ).toBeVisible();

      // Simulate the payment-window sweep releasing the claim and moving to batch 2.
      expireParkingPaymentAndResumeSearch(state);
      expect(state.batchNumber).toBe(2);

      await guestPage.reload();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.findingHost })
      ).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByText('Checking more hosts nearby')).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-resumed-search', { role: 'guest' });

      await hostPage.reload();
      await expect(hostPage.getByRole('button', { name: parkingFlowLabels.accept })).toBeVisible({
        timeout: 15_000,
      });
      await captureParkingScreen(hostPage, 'host-batch-two', { role: 'host' });

      await hostAcceptPendingBooking(hostPage, 'Second round acceptance.');
      await guestPage.reload();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.payToConfirm })
      ).toBeVisible({ timeout: 15_000 });
      await guestPayForParking(guestPage, state);
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.parkingConfirmed })
      ).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-resumed-paid', { role: 'guest' });
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });

  test('guest cancel while searching updates the host request list', async ({
    page: _page,
  }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    setParkingScreenSuite('side-by-side-cancel-searching');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage, { skipScreens: true });
      await openHostListFresh(hostPage);
      await captureParkingScreen(hostPage, 'host-sees-searching', { role: 'host' });

      await guestPage.getByRole('button', { name: parkingFlowLabels.cancelRequest }).click();
      await guestPage
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Cancel request' })
        .click();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.requestCancelled })
      ).toBeVisible();

      // A fresh context avoids the persisted 15s query cache, so the host sees
      // exactly what a new dashboard session would show after the guest cancels.
      const freshContext = await browsers.hostBrowser.newContext({
        viewport: { width: 900, height: 960 },
      });
      const freshHostPage = await freshContext.newPage();
      try {
        await installParkingFlowMocks(freshHostPage, state);
        await freshHostPage.goto(parkingFlowPaths.hostBookings);
        const cancelledRow = freshHostPage.getByRole('button', {
          name: /Open booking for Jamie Park/,
        });
        await expect(cancelledRow).toContainText('Cancelled', { timeout: 15_000 });
        await captureParkingScreen(freshHostPage, 'host-sees-cancelled', { role: 'host' });
      } finally {
        await freshContext.close();
      }
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });

  test('host can cancel a paid booking and the guest sees it cancelled', async ({
    page: _page,
  }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    setParkingScreenSuite('side-by-side-host-cancel-paid');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage, { skipScreens: true });
      await openHostBooking(hostPage);
      await hostAcceptPendingBooking(hostPage);
      await guestPage.reload();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.payToConfirm })
      ).toBeVisible({ timeout: 15_000 });
      await guestPayForParking(guestPage, state);

      // Fresh host context so the paid status is not served from the 15s cache.
      const freshContext = await browsers.hostBrowser.newContext({
        viewport: { width: 900, height: 960 },
      });
      const freshHostPage = await freshContext.newPage();
      try {
        await installParkingFlowMocks(freshHostPage, state);
        await freshHostPage.goto(parkingFlowPaths.hostBookingDetail);
        await expect(
          freshHostPage.getByText(parkingHostStatusLabels.pendingReview).first()
        ).toBeVisible({ timeout: 15_000 });
        const cancelResponse = freshHostPage.waitForResponse(
          (response) =>
            response.url().includes('/functions/v1/transition-parking-booking') && response.ok()
        );
        await freshHostPage.getByRole('button', { name: 'Cancel', exact: true }).first().click();
        await cancelResponse;
        await expect(
          freshHostPage.getByText(parkingHostStatusLabels.cancelled).first()
        ).toBeVisible({ timeout: 15_000 });
        await captureParkingScreen(freshHostPage, 'host-cancelled-paid', { role: 'host' });
      } finally {
        await freshContext.close();
      }

      expect(state.status).toBe('CANCELLED');
      // Fresh guest context so the confirmed status is not restored from cache.
      const guestContext = await browsers.guestBrowser.newContext({
        viewport: { width: 900, height: 960 },
      });
      const freshGuestPage = await guestContext.newPage();
      try {
        await installParkingFlowMocks(freshGuestPage, state);
        await freshGuestPage.goto(parkingFlowPaths.guestStatus);
        await expect(
          freshGuestPage.getByRole('heading', { name: parkingGuestStatusLabels.requestCancelled })
        ).toBeVisible({ timeout: 15_000 });
        await captureParkingScreen(freshGuestPage, 'guest-cancelled-by-host', { role: 'guest' });
      } finally {
        await guestContext.close();
      }
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });

  test('losing the claim race shows Already claimed and moves the request on', async ({
    page: _page,
  }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    state.claimFailsAlreadyClaimed = true;
    setParkingScreenSuite('side-by-side-claim-race');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage, { skipScreens: true });
      await openHostBooking(hostPage);
      await hostAcceptPendingBooking(hostPage);

      await expect(hostPage.getByText('Already claimed')).toBeVisible({ timeout: 15_000 });
      await captureParkingScreen(hostPage, 'host-claim-race-toast', { role: 'host' });

      const freshContext = await browsers.hostBrowser.newContext({
        viewport: { width: 900, height: 960 },
      });
      const freshHostPage = await freshContext.newPage();
      try {
        await installParkingFlowMocks(freshHostPage, state);
        await freshHostPage.goto(parkingFlowPaths.hostBookingDetail);
        await expect(
          freshHostPage.getByText(parkingHostStatusLabels.awaitingPayment).first()
        ).toBeVisible({ timeout: 15_000 });
        await expect(
          freshHostPage.getByRole('button', { name: parkingFlowLabels.accept })
        ).toHaveCount(0);
        await captureParkingScreen(freshHostPage, 'host-claim-race-detail', { role: 'host' });
      } finally {
        await freshContext.close();
      }
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });

  test('failed endorsement shows Retry, then reveals host contact and chat', async ({
    page: _page,
  }, testInfo) => {
    test.setTimeout(sideBySideTimeoutMs());
    test.skip(
      testInfo.project.name !== 'chromium-side-by-side',
      'Run this scenario with the chromium-side-by-side project.'
    );

    const state = createParkingFlowState();
    state.endorsementSendFails = true;
    setParkingScreenSuite('side-by-side-endorsement-retry');
    const browsers = await launchParkingSideBySideBrowsers();

    try {
      const { guestPage, hostPage } = browsers;
      await installParkingFlowMocks(guestPage, state);
      await installParkingFlowMocks(hostPage, state);

      await submitGuestParkingRequest(guestPage, { skipScreens: true });
      await openHostBooking(hostPage);
      await hostAcceptPendingBooking(hostPage);

      await guestPage.reload();
      await expect(
        guestPage.getByRole('heading', { name: parkingGuestStatusLabels.payToConfirm })
      ).toBeVisible({ timeout: 15_000 });
      await guestPayForParking(guestPage, state);

      await expect(guestPage.getByText('Endorsement didn’t send.')).toBeVisible({
        timeout: 15_000,
      });
      await captureParkingScreen(guestPage, 'guest-endorsement-failed', { role: 'guest' });

      await guestPage.getByRole('button', { name: 'Retry' }).click();
      await expect(
        guestPage.getByRole('button', { name: parkingGuestStatusLabels.hostAndEndorsement })
      ).toBeVisible({ timeout: 15_000 });
      await guestPage
        .getByRole('button', { name: parkingGuestStatusLabels.hostAndEndorsement })
        .click();
      await expect(guestPage.getByText('Parking Host')).toBeVisible();
      await expect(guestPage.getByText('host@example.com')).toBeVisible();
      await captureParkingScreen(guestPage, 'guest-endorsement-retried', { role: 'guest' });

      await guestPage
        .getByRole('button', { name: parkingGuestStatusLabels.chatWithHost })
        .click();
      await expect(guestPage.getByText('Hi, I am on my way to the slot.')).toBeVisible({
        timeout: 15_000,
      });
      await captureParkingScreen(guestPage, 'guest-chat-open', { role: 'guest' });
      await demoPause(guestPage, hostPage);
    } finally {
      await closeParkingSideBySideBrowsers(browsers);
    }
  });
});

