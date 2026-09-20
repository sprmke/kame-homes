
import { seedSupabaseAuthSession } from '../../../shared/authSeam';
import { E2E_GUEST_USER_ID } from '../../../shared/ids';
import { mockPublicPropertyBody } from '../../../shared/mockFixtures';

import type { Page, Route } from '@playwright/test';

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function installGuestFavoritesMocks(
  page: Page,
  savedSlugs: string[] = ['solea-mactan']
) {
  await seedSupabaseAuthSession(page, 'guest');

  await page.route('**/auth/v1/user**', async (route) => {
    await fulfillJson(route, {
      id: E2E_GUEST_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'guest@example.com',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'E2E Guest' },
    });
  });

  await page.route(/guest_saved_properties/, async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(
        route,
        savedSlugs.map((property_slug) => ({ property_slug }))
      );
      return;
    }
    await fulfillJson(route, {});
  });

  await page.route('**/functions/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split('/').pop();
    if (endpoint === 'get-public-property') {
      await fulfillJson(route, mockPublicPropertyBody);
      return;
    }
    if (endpoint === 'guest-profile') {
      await fulfillJson(route, {
        success: true,
        data: {
          displayName: 'E2E Guest',
          bio: null,
          avatarUrl: null,
          phone: null,
          locationLabel: null,
          email: 'guest@example.com',
        },
      });
      return;
    }
    if (endpoint === 'guest-messages') {
      await fulfillJson(route, {
        success: true,
        data: { threads: [] },
      });
      return;
    }
    await route.continue();
  });
}
