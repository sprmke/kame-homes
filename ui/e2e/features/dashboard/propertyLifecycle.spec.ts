import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

const lifecycle = (overrides: Record<string, unknown> = {}) => ({
  propertyId: 'property-1',
  name: 'Solea Mactan',
  slug: 'azure-2604',
  state: 'live',
  inactiveReason: null,
  inactiveReasonLabel: null,
  archivedAt: null,
  pausedAt: null,
  canHostActivate: true,
  activationBlock: null,
  allowedActions: ['pause', 'archive'],
  canDelete: true,
  acceptsNewBookings: true,
  ...overrides,
});

const impact = (overrides: Record<string, unknown> = {}) => ({
  propertyId: 'property-1',
  state: 'live',
  bookings: {
    blocking: [],
    blockingCount: 0,
    upcoming: 0,
    inHouse: 0,
    pendingSdRefunds: 0,
    history: 0,
  },
  cancellationRequestsOpen: 0,
  refundsOpen: 0,
  calendar: { importFeeds: 0, exportEnabled: false },
  marketing: { scheduledPosts: 0 },
  team: { members: 0, pendingInvitations: 0 },
  subscription: { billed: false },
  deleteBlockers: { total: 0, bookings: 0, finance: 0, maintenance: 0, importBatches: 0 },
  cascade: { inboxThreads: 0, reviews: 0, paymentTransactions: 0, marketingRecords: 0 },
  ...overrides,
});

test.describe('@ci property listing status', () => {
  test('live listing shows pause and archive actions', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.settings);
    const section = page.locator('#section-danger');
    await expect(section.getByText('Live', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(section.getByRole('button', { name: 'Pause' })).toBeEnabled();
    await expect(section.getByRole('button', { name: 'Archive' })).toBeEnabled();
    // Members cannot delete; the row is owner-only.
    await expect(section.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  });

  test('archive is blocked while a stay is open', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.route('**/functions/v1/property-lifecycle*', async (route) => {
      const url = new URL(route.request().url());
      const blocking = {
        id: 'booking-1',
        status: 'READY_FOR_CHECKIN',
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-03',
        guestName: 'Maria Santos',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data:
            url.searchParams.get('impact') === '1'
              ? {
                  lifecycle: lifecycle(),
                  impact: impact({
                    bookings: {
                      blocking: [blocking],
                      blockingCount: 1,
                      upcoming: 1,
                      inHouse: 0,
                      pendingSdRefunds: 0,
                      history: 1,
                    },
                  }),
                }
              : { lifecycle: lifecycle() },
        }),
      });
    });

    await page.goto(teamRbacPaths.settings);
    const section = page.locator('#section-danger');
    await section.getByRole('button', { name: 'Archive' }).click();

    await expect(page.getByText('Finish or cancel these bookings first.')).toBeVisible();
    await expect(page.getByText('Maria Santos')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archive property' })).toBeDisabled();
  });

  test('delete requires the exact property name', async ({ page }) => {
    // Owner access: permanent delete is owner-only.
    await installPropertyTeamRbacMocks(page, 'owner');
    await page.goto(teamRbacPaths.settings);
    const section = page.locator('#section-danger');
    await section.getByRole('button', { name: 'Delete' }).click();

    const confirm = page.getByRole('button', { name: 'Delete property' });
    await expect(confirm).toBeDisabled();
    await page.locator('#delete-property-confirm').fill('Solea Mactan');
    await expect(confirm).toBeEnabled();
  });
});
