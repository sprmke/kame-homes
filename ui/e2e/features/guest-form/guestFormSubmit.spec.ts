import path from 'node:path';

import { expect, test } from '@playwright/test';

import { guestFormPath, installGuestFormMocks } from './shared/guestFormHarness';
import { seedSupabaseAuthSession } from '../../shared/authSeam';

const VALID_ID_FIXTURE = path.join(process.cwd(), 'ui/public/icons/pwa-192.png');

test.describe('@smoke @ci guest form submit', () => {
  test('Airbnb guest can submit mocked form and reach success', async ({ page }) => {
    test.setTimeout(60_000);

    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page, { allowPets: false, allowParking: false });

    await page.goto(guestFormPath('source=airbnb'));
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', {
      timeout: 20_000,
    });

    await page.getByLabel('Airbnb Name').fill('Maria Santos');
    await page.getByLabel('Email Address').fill('maria@example.com');
    await page.getByLabel('Phone Number').fill('09171234567');
    await page.getByRole('textbox', { name: 'Address *', exact: true }).fill('Cebu City, Cebu');
    await page.getByLabel('Nationality').fill('Filipino');
    await page.getByPlaceholder('Complete name of Primary Guest').fill('Maria Santos');
    await page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) })
      .getByLabel('Age *')
      .fill('25');
    await page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Primary Guest *' }) })
      .locator('input[type="file"]')
      .setInputFiles(VALID_ID_FIXTURE);

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Stay', {
      timeout: 10_000,
    });

    const submit = page.getByRole('button', { name: 'Submit guest form' });
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();
    await expect(page.getByText('Booking Confirmed!')).toBeVisible({ timeout: 30_000 });
  });
});
