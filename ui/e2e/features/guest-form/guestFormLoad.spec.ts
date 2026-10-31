import { expect, test } from '@playwright/test';

import { guestFormPath, installGuestFormMocks } from './shared/guestFormHarness';
import { seedSupabaseAuthSession } from '../../shared/authSeam';
import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';

test.describe('@smoke guest form load', () => {
  test('renders booking form for property-scoped URL', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'guest');
    await installGuestFormMocks(page);
    await page.goto(guestFormPath());
    await expect(page.locator('#guest-form-step-heading')).toHaveText('Guest', {
      timeout: 20_000,
    });
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);
  });
});
