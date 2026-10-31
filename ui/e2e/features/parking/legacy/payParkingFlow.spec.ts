import { expect, test } from '@playwright/test';

import { setParkingScreenSuite } from '../shared/parkingScreenCapture';
import {
  createPayParkingFlowState,
  expectLegacyPayParkingRedirectsToFind,
  expectLegacyPayParkingRedirectsToLinkedRequest,
  installPayParkingFlowMocks,
  PAY_PARKING_LINKED_REQUEST_ID,
} from '../shared/payParkingFlowHarness';

test.describe('legacy property pay-parking → marketplace redirect', () => {
  test('unlinked stay redirects to find parking with linkStay', async ({ page }) => {
    setParkingScreenSuite('pay-parking-find-redirect');
    const state = createPayParkingFlowState();
    await installPayParkingFlowMocks(page, state);

    await expectLegacyPayParkingRedirectsToFind(page, state);
  });

  test('unlinked stay with city redirects to /parkings/in/:city?linkStay=', async ({ page }) => {
    setParkingScreenSuite('pay-parking-city-redirect');
    const state = createPayParkingFlowState({ cityLocationSlug: 'cebu-city' });
    await installPayParkingFlowMocks(page, state);

    await expectLegacyPayParkingRedirectsToFind(page, state);
  });

  test('linked stay redirects to marketplace request status', async ({ page }) => {
    setParkingScreenSuite('pay-parking-linked-redirect');
    const state = createPayParkingFlowState({
      linkedParkingBookingId: PAY_PARKING_LINKED_REQUEST_ID,
    });
    await installPayParkingFlowMocks(page, state);

    await expectLegacyPayParkingRedirectsToLinkedRequest(page, state);
  });
});
