import { expect, test } from '@playwright/test';

import {
  createAvailableVoucher,
  createUsedVoucher,
  createVoucherRedemptionGuestState,
  demoPause,
  installVoucherRedemptionGuestMocks,
  voucherRedemptionPaths,
  voucherRedemptionTimeoutMs,
} from '../shared/voucherRedemptionHarness';

test.describe('@smoke @ci guest — voucher wallet', () => {
  test('lists ready and used vouchers with Book again link', async ({ page }) => {
    test.setTimeout(voucherRedemptionTimeoutMs());
    const guest = createVoucherRedemptionGuestState({
      vouchers: [createAvailableVoucher(), createUsedVoucher()],
    });
    await installVoucherRedemptionGuestMocks(page, guest);

    await page.goto(voucherRedemptionPaths.wallet);
    await expect(page.getByText('Ready to use')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('10% off').first()).toBeVisible();
    await expect(page.getByText('OFF-10').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Book again' })).toHaveAttribute(
      'href',
      '/properties/solea-mactan/form'
    );

    await expect(page.getByText('Used', { exact: true }).first()).toBeVisible();
    await demoPause(page);
  });

  test('Book again navigates to property booking form', async ({ page }) => {
    test.setTimeout(voucherRedemptionTimeoutMs());
    const guest = createVoucherRedemptionGuestState();
    await installVoucherRedemptionGuestMocks(page, guest);

    await page.goto(voucherRedemptionPaths.wallet);
    await demoPause(page);
    await page.getByRole('link', { name: 'Book again' }).click();
    await expect(page).toHaveURL(/\/properties\/solea-mactan\/form/);
    await demoPause(page);
  });
});
