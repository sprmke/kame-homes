import { expect, test } from '@playwright/test';

import {
  createVoucherGuestState,
  installVoucherRevealGuestMocks,
  useReducedMotionForVoucherClaim,
  VOUCHER_REVEAL_WORLDS,
  voucherGuestPaths,
} from '../shared/voucherRevealHarness';

const GUEST_WORLDS = Object.values(VOUCHER_REVEAL_WORLDS);

test.describe('guest — SD form voucher reveal worlds', () => {
  for (const world of GUEST_WORLDS) {
    test(`${world.style} world — claim shows style copy then won card`, async ({ page }) => {
      await useReducedMotionForVoucherClaim(page);
      const guest = createVoucherGuestState({ revealStyle: world.style });
      await installVoucherRevealGuestMocks(page, guest);

      await page.goto(voucherGuestPaths().sdForm(guest.bookingId));
      await expect(page.getByRole('heading', { name: world.introHeadline })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole('button', { name: 'Claim it!' }).click();
      await expect(page.getByText('You won')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('OFF-10')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue to refund process' })).toBeVisible();
      expect(guest.claimCalls).toBe(1);
    });
  }

  test('returning guest with existing voucher skips animation', async ({ page }) => {
    await useReducedMotionForVoucherClaim(page);
    const guest = createVoucherGuestState({
      revealStyle: 'wheel',
      existingVoucherCode: 'OFF-25',
      existingVoucherAmount: 25,
    });
    await installVoucherRevealGuestMocks(page, guest);

    await page.goto(voucherGuestPaths().sdForm(guest.bookingId));
    await expect(page.getByText('You won')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('OFF-25')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Claim it!' })).toHaveCount(0);
    expect(guest.claimCalls).toBe(0);
  });
});

test.describe('guest — guest-review voucher reveal worlds', () => {
  for (const world of GUEST_WORLDS) {
    test(`${world.style} world — Airbnb path uses Done after reveal`, async ({ page }) => {
      await useReducedMotionForVoucherClaim(page);
      const guest = createVoucherGuestState({ revealStyle: world.style });
      await installVoucherRevealGuestMocks(page, guest);

      await page.goto(voucherGuestPaths().guestReview(guest.bookingId));
      await expect(page.getByRole('heading', { name: world.introHeadline })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole('button', { name: 'Claim it!' }).click();
      await expect(page.getByText('You won')).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByText('Thanks for your review')).toBeVisible();
    });
  }
});
