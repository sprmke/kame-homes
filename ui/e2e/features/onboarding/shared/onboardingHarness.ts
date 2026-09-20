import { seedSupabaseAuthSession } from '../../../shared/authSeam';

import type { Page, Route } from '@playwright/test';


async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const nameAvailable = { success: true, data: { available: true, message: null } };

const towerUnitAvailable = {
  success: true,
  data: {
    available: true,
    hasActiveListing: false,
    message: null,
    conflict: null,
  },
};

/** Host session + empty org list + availability checks for onboarding wizard. */
export async function installOnboardingMocks(page: Page) {
  await seedSupabaseAuthSession(page, 'host');

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'list-organizations':
        await fulfillJson(route, { success: true, data: { organizations: [] } });
        return;
      case 'check-organization-name':
        await fulfillJson(route, nameAvailable);
        return;
      case 'check-property-name':
        await fulfillJson(route, nameAvailable);
        return;
      case 'check-tower-unit':
        await fulfillJson(route, towerUnitAvailable);
        return;
      default:
        await route.continue();
    }
  });
}
