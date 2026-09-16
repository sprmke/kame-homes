import type { Page, Route } from '@playwright/test';

import { seedSupabaseAuthSession } from '../../../shared/authSeam';

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export const mockPendingOrgApproval = {
  type: 'org_verification' as const,
  organizationId: 'org-pending-001',
  organizationName: 'Pending Host Co',
  organizationSlug: 'pending-host-co',
  hostModes: ['property'],
  ownerName: 'Pending Owner',
  ownerEmail: 'pending@example.com',
  baseStatus: 'pending',
  baseSubmittedAt: '2026-09-10T00:00:00.000Z',
  baseRejectionReason: null,
  baseRejectionKind: null,
  enhancedStatus: 'none',
  enhancedSubmittedAt: null,
  createdAt: '2026-09-10T00:00:00.000Z',
  unitConflicts: [],
  hasActiveUnitConflict: false,
  propertyConsiderationStatus: 'none',
  parkingConsiderationStatus: 'none',
  hasPendingConsideration: false,
  propertyAccessLocked: false,
  parkingAccessLocked: false,
};

export const mockApprovalsSummary = {
  total: 1,
  pending: 1,
  orgVerifications: 1,
  listingVerifications: 0,
  reviews: 0,
};

/** Super-admin session + mocked approvals queue list + summary. */
export async function installAdminApprovalsMocks(page: Page) {
  await seedSupabaseAuthSession(page, 'host');

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();
    const isSummary = url.searchParams.get('summary') === 'true';

    if (endpoint === 'list-organizations') {
      await fulfillJson(route, {
        success: true,
        data: { organizations: [], isSuperAdmin: true },
      });
      return;
    }

    if (endpoint === 'list-super-admin-approvals') {
      if (isSummary) {
        await fulfillJson(route, { success: true, data: { summary: mockApprovalsSummary } });
        return;
      }
      await fulfillJson(route, {
        success: true,
        data: { approvals: [mockPendingOrgApproval], total: 1 },
      });
      return;
    }

    await route.continue();
  });
}
