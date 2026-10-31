import { expect, test } from '@playwright/test';

import {
  createVoucherGuestState,
  installVoucherRevealGuestMocks,
  VOUCHER_REVEAL_WORLDS,
  voucherGuestPaths,
  type VoucherRevealStyle,
} from '../shared/voucherRevealHarness';

/**
 * Visual demo — full-length animations (no reduced motion). Run headed with slowMo:
 * `bun run test:e2e:vouchers:demo`
 */
const DEMO_STYLES: VoucherRevealStyle[] = ['reel', 'wheel', 'flip'];

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('voucher reveal styles — visual demo @demo', () => {
  for (const style of DEMO_STYLES) {
    test(`${style} world — full animation on SD form`, async ({ page }) => {
      const world = VOUCHER_REVEAL_WORLDS[style];
      const guest = createVoucherGuestState({ revealStyle: style });
      await installVoucherRevealGuestMocks(page, guest);

      await page.goto(voucherGuestPaths().sdForm(guest.bookingId));
      await expect(page.getByRole('heading', { name: world.introHeadline })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole('button', { name: 'Claim it!' }).click();
      await expect(page.getByLabel(world.animationAriaLabel)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('You won')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('OFF-10')).toBeVisible();
    });
  }
});
