import { expect, test } from '@playwright/test';

import {
  confirmHostPendingReviewAck,
  continueGuestForm,
  createVoucherRedemptionGuestState,
  createVoucherRedemptionHostState,
  demoPause,
  fillMinimalGuestFormStep1,
  installVoucherRedemptionMocks,
  selectVoucherOnForm,
  submitGuestForm,
  switchToVoucherRedemptionHostSession,
  VOUCHER_REDEEMING_BOOKING_ID,
  VOUCHER_SOURCE_BOOKING_ID,
  voucherRedemptionPaths,
  voucherRedemptionTimeoutMs,
} from '../shared/voucherRedemptionHarness';

/**
 * End-to-end mocked journey: wallet → form apply → host pricing review.
 *
 * **Not covered:** sharing a voucher inside property messages — product has no
 * voucher attach action in chat yet; guests use `/account/vouchers` or the form picker.
 */
test.describe('voucher redemption — mocked full journey', () => {
  test('returning guest books again with wallet voucher; host sees applied discount', async ({
    page,
  }) => {
    test.setTimeout(voucherRedemptionTimeoutMs());
    const guest = createVoucherRedemptionGuestState();
    const host = createVoucherRedemptionHostState();
    await installVoucherRedemptionMocks(page, guest, host);

    await page.goto(voucherRedemptionPaths.wallet);
    await expect(page.getByText('Ready to use')).toBeVisible({ timeout: 15_000 });
    await demoPause(page);

    await page.getByRole('link', { name: 'Book again' }).click();
    await expect(page).toHaveURL(/\/properties\/solea-mactan\/form/);
    await demoPause(page);

    // Book again opens bare `/form`; add the same date/source params a calendar handoff would carry.
    await page.goto(voucherRedemptionPaths.guestForm());
    await demoPause(page);

    await fillMinimalGuestFormStep1(page);
    await continueGuestForm(page);
    await selectVoucherOnForm(page, 'OFF-10');
    await submitGuestForm(page);
    await expect(page).toHaveURL(/\/success/, { timeout: 20_000 });
    expect(guest.lastSubmitFields?.appliedVoucherSourceBookingId).toBe(VOUCHER_SOURCE_BOOKING_ID);
    await demoPause(page);

    await switchToVoucherRedemptionHostSession(page);
    await page.goto(voucherRedemptionPaths.hostBookingDetail(VOUCHER_REDEEMING_BOOKING_ID));
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 20_000,
    });
    await demoPause(page);

    await confirmHostPendingReviewAck(page);
    await expect(page.getByText('10% off (OFF-10)')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('−₱600.00')).toBeVisible();
    await demoPause(page);
  });

  test('property messages insert menu has no voucher share (known gap)', async ({ page }) => {
    test.setTimeout(voucherRedemptionTimeoutMs());
    const guest = createVoucherRedemptionGuestState();
    await installVoucherRedemptionMocks(page, guest, createVoucherRedemptionHostState());

    await page.goto(voucherRedemptionPaths.propertyMessages());
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible({
      timeout: 20_000,
    });
    await demoPause(page);

    await page.getByRole('button', { name: 'Insert' }).click();
    await expect(page.getByRole('button', { name: 'Share my dates' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check availability' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View listing' })).toBeVisible();
    await expect(page.getByRole('button', { name: /voucher/i })).toHaveCount(0);
    await demoPause(page);
  });
});
