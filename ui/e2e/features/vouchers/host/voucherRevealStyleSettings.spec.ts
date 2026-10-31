import { expect, test } from '@playwright/test';

import {
  createVoucherHostState,
  installVoucherRevealHostMocks,
  openVoucherManageModal,
  openVoucherSettingsSection,
  savePropertySettings,
  selectRevealStyleInModal,
  type VoucherRevealStyle,
} from '../shared/voucherRevealHarness';

const HOST_STYLE_CASES: Array<{
  style: VoucherRevealStyle;
  label: string;
  initial: VoucherRevealStyle;
}> = [
  { style: 'wheel', label: 'Wheel', initial: 'reel' },
  { style: 'flip', label: 'Flip', initial: 'reel' },
  { style: 'reel', label: 'Reel', initial: 'flip' },
];

test.describe('host — voucher reveal style settings', () => {
  for (const { style, label, initial } of HOST_STYLE_CASES) {
    test(`saves ${label} reveal style from Reviews & vouchers`, async ({ page }) => {
      const host = createVoucherHostState({ voucherRevealStyle: initial });
      await installVoucherRevealHostMocks(page, host);
      await openVoucherSettingsSection(page);
      await openVoucherManageModal(page);
      await selectRevealStyleInModal(page, style);
      await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
      const summary = page.locator('text=Next-stay vouchers').first();
      await expect(summary).toBeVisible();
      if (style === 'reel') {
        await expect(summary).not.toContainText(' · Wheel');
        await expect(summary).not.toContainText(' · Flip');
      } else {
        await expect(summary).toContainText(` · ${label}`);
      }
      await savePropertySettings(page);

      const lastPatch = host.patchBodies.at(-1);
      expect(lastPatch?.voucherRevealStyle).toBe(style);
      expect(host.voucherRevealStyle).toBe(style);
    });
  }

  test('Reset defaults restores Reel style', async ({ page }) => {
    const host = createVoucherHostState({ voucherRevealStyle: 'flip' });
    await installVoucherRevealHostMocks(page, host);
    await openVoucherSettingsSection(page);
    await openVoucherManageModal(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Reset defaults' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await savePropertySettings(page);

    expect(host.voucherRevealStyle).toBe('reel');
    expect(host.patchBodies.at(-1)?.voucherRevealStyle).toBe('reel');
  });
});
