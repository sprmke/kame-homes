import { expect, test } from '@playwright/test';

import { guestCalendarPath, installGuestFormMocks } from './shared/guestFormHarness';
import { seedSupabaseAuthSession } from '../../shared/authSeam';

test.describe('@ci guest calendar smoke', () => {
  test('calendar loads with booked dates mock', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page, {
      bookedDates: ['2026-09-20', '2026-09-21'],
    });

    await page.goto(guestCalendarPath());
    await expect(page.getByRole('heading', { name: 'Check Availability' })).toBeVisible({
      timeout: 20_000,
    });
  });
});
