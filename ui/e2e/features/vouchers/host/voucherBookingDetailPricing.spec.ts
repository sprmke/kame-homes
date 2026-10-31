import { expect, test } from '@playwright/test';

import {
  confirmHostPendingReviewAck,
  createVoucherRedemptionHostState,
  demoPause,
  e2eRedeemingBookingRow,
  installVoucherRedemptionHostMocks,
  openHostPricingTab,
  voucherRedemptionPaths,
  voucherRedemptionTimeoutMs,
} from '../shared/voucherRedemptionHarness';

test.describe('host — booking with applied guest voucher', () => {
  test('PENDING_REVIEW workflow shows voucher discount in pricing review', async ({ page }) => {
    test.setTimeout(voucherRedemptionTimeoutMs());
    const host = createVoucherRedemptionHostState({
      booking: e2eRedeemingBookingRow({ status: 'PENDING_REVIEW' }),
    });
    await installVoucherRedemptionHostMocks(page, host);

    await page.goto(voucherRedemptionPaths.hostBookingDetail());
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 20_000,
    });
    await demoPause(page);

    await confirmHostPendingReviewAck(page);
    await expect(page.getByText('10% off (OFF-10)')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('−₱600.00')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proceed to Ready for Check-in' })).toBeVisible();
    await demoPause(page);
  });

  test('pricing tab shows Guest voucher card after review', async ({ page }) => {
    test.setTimeout(voucherRedemptionTimeoutMs());
    const host = createVoucherRedemptionHostState({
      booking: e2eRedeemingBookingRow({
        status: 'PENDING_DOCUMENTS',
        booking_rate: 4500,
      }),
    });
    await installVoucherRedemptionHostMocks(page, host);

    await page.goto(voucherRedemptionPaths.hostBookingDetail());
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 20_000,
    });
    await demoPause(page);

    await openHostPricingTab(page);
    await expect(page.getByText('Guest voucher')).toBeVisible();
    await expect(page.getByText('OFF-10', { exact: true })).toBeVisible();
    await expect(page.getByText('−₱500.00 on booking rate')).toBeVisible();
    await demoPause(page);
  });
});
