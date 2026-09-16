import { expect, test } from '@playwright/test';

import { seedSupabaseAuthSession } from '../../shared/authSeam';
import { mockEdgeFunctions } from '../../shared/interceptEdge';
import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';

const mockSuperAdminOverview = {
  success: true,
  data: {
    range: '30d',
    generatedAt: '2026-09-10T00:00:00.000Z',
    kpis: {
      organizations: 1,
      hosts: 1,
      properties: 2,
      parkings: 0,
      liveSubscriptions: 1,
      mrrPhp: 0,
      openTickets: 0,
      pendingApprovals: 0,
      undisbursedParkingPayouts: 0,
      aiSpendUsd: 0,
    },
    growthSeries: [],
    planMix: [],
    aiCostByFeature: [],
    attention: {
      pendingApprovals: 0,
      pendingApprovalsBreakdown: {
        orgVerification: 0,
        listingVerification: 0,
        externalReview: 0,
      },
      openTickets: 0,
      undisbursedParkingPayouts: 0,
      unassignedSubscriptions: 0,
    },
    recent: { organizations: [], subscriptions: [], tickets: [] },
  },
};

test.describe('@smoke @ci super admin shell', () => {
  test('admin overview renders for mocked super-admin session', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'host');
    await mockEdgeFunctions(page, [
      {
        name: 'list-organizations',
        body: { success: true, data: { organizations: [], isSuperAdmin: true } },
      },
      { name: 'super-admin-overview', body: mockSuperAdminOverview },
    ]);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({
      timeout: 20_000,
    });
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);
  });

  test('non-super-admin host sees access restricted on /admin', async ({ page }) => {
    await seedSupabaseAuthSession(page, 'host');
    await page.addInitScript((key: string) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const session = JSON.parse(raw) as { user?: { email?: string } };
      if (session.user) session.user.email = 'not-super-admin@example.com';
      window.localStorage.setItem(key, JSON.stringify(session));
    }, 'sb-127-auth-token');
    await mockEdgeFunctions(page, [
      {
        name: 'list-organizations',
        body: { success: true, data: { organizations: [], isSuperAdmin: false } },
      },
    ]);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Access restricted' })).toBeVisible({
      timeout: 20_000,
    });
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);
  });
});
