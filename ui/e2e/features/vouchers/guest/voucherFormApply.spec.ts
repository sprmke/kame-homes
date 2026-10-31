import { expect, test } from '@playwright/test';

import {
  continueGuestForm,
  createVoucherRedemptionGuestState,
  demoPause,
  fillMinimalGuestFormStep1,
  installVoucherRedemptionGuestMocks,
  selectVoucherOnForm,
  submitGuestForm,
  VOUCHER_SOURCE_BOOKING_ID,
  voucherRedemptionPaths,
  voucherRedemptionTimeoutMs,
} from '../shared/voucherRedemptionHarness';

test.describe('guest — apply voucher on booking form', () => {
  test('shows eligible voucher, discount estimate, and sends source booking on submit', async ({
    page,
  }) => {
    test.setTimeout(voucherRedemptionTimeoutMs());
    const guest = createVoucherRedemptionGuestState();
    await installVoucherRedemptionGuestMocks(page, guest);

    await page.goto(voucherRedemptionPaths.guestForm());
    await expect(page.getByRole('heading', { name: 'Guest', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await demoPause(page);

    await fillMinimalGuestFormStep1(page);
    await continueGuestForm(page);
    await expect(page.getByRole('heading', { name: 'Stay' })).toBeVisible();

    await selectVoucherOnForm(page, 'OFF-10');
    await expect(page.getByText('Estimated stay')).toBeVisible();
    await expect(page.getByText('After voucher')).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: /−₱[\d,]+\.\d{2}/ })).toBeVisible();

    await submitGuestForm(page);
    await expect(page).toHaveURL(/\/success/, { timeout: 20_000 });
    await demoPause(page);

    expect(guest.submitCalls).toBe(1);
    expect(guest.lastSubmitFields?.appliedVoucherSourceBookingId).toBe(VOUCHER_SOURCE_BOOKING_ID);
  });

  test('None clears voucher selection', async ({ page }) => {
    test.setTimeout(voucherRedemptionTimeoutMs());
    const guest = createVoucherRedemptionGuestState();
    await installVoucherRedemptionGuestMocks(page, guest);

    await page.goto(voucherRedemptionPaths.guestForm());
    await fillMinimalGuestFormStep1(page);
    await continueGuestForm(page);

    await selectVoucherOnForm(page, 'OFF-10');
    await expect(page.getByText('After voucher')).toBeVisible();

    const group = page.getByRole('group', { name: 'Vouchers' });
    await group.getByRole('button', { name: 'None' }).click();
    await expect(page.getByText('After voucher')).toHaveCount(0);
    await demoPause(page);
  });
});
