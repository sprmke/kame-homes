import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  openPropertyDashboard,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

test.describe('@ci dashboard module shells', () => {
  test.describe.configure({ mode: 'serial' });

  test('property finance page loads for Full Access', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    const summaryReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/finance-summary') && res.ok()
    );
    await page.goto('/org/sample-stays-ph/property/solea-mactan/finance');
    await summaryReady;
    await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('finance card header titles never sit under their filter at 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto('/org/sample-stays-ph/property/solea-mactan/finance');
    const filter = page.getByRole('tablist', { name: 'Breakdown filter' });
    await expect(filter).toBeVisible({ timeout: 20_000 });
    const title = page.getByText('Breakdown', { exact: true });
    // Measure the rendered text, not the <p> box: a shrunk box lets the text spill under the filter.
    const text = await title.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const { right, bottom } = range.getBoundingClientRect();
      return { right, bottom };
    });
    const filterBox = await filter.boundingBox();
    // Side by side, or the filter wrapped onto its own row: either way, never on top of the text.
    expect(text.right <= filterBox!.x || text.bottom <= filterBox!.y).toBe(true);
  });

  test('property dashboard loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await openPropertyDashboard(page);
    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('property maintenance page loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto('/org/sample-stays-ph/property/solea-mactan/maintenance');
    await expect(page.getByRole('heading', { name: 'Maintenance' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('property pricing page loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    const pricingReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/property-pricing') && res.ok()
    );
    await page.goto('/org/sample-stays-ph/property/solea-mactan/pricing');
    await pricingReady;
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('property settings page loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto('/org/sample-stays-ph/property/solea-mactan/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('property notifications page loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.route('**/functions/v1/notification-preferences**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            preferences: {
              mutedGroups: [],
              quietHoursEnabled: false,
              quietHoursStart: '22:00',
              quietHoursEnd: '07:00',
              quietHoursTimezone: 'Asia/Manila',
            },
          },
        }),
      })
    );
    await page.goto('/org/sample-stays-ph/property/solea-mactan/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('property templates page loads', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => consoleMessages.push(msg.text()));

    await installPropertyTeamRbacMocks(page, 'full_access');
    const templatesReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/property-templates-settings') && res.ok()
    );
    await page.goto('/org/sample-stays-ph/property/solea-mactan/templates');
    await templatesReady;
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    /* Workbench shape: the library rail beside one open editor. */
    const rail = page.getByRole('complementary', { name: 'Templates' });
    await expect(rail).toBeVisible();
    await expect(rail.getByText('Stay guide')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Template editor' }).getByRole('heading').first()
    ).toBeVisible();

    const duplicateWarnings = consoleMessages.filter((text) =>
      text.toLowerCase().includes('duplicate')
    );
    expect(duplicateWarnings).toEqual([]);
  });

  test('custom template sends to a picked booking', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { customTemplateSeeded: true });
    const templatesReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/property-templates-settings') && res.ok()
    );
    await page.goto('/org/sample-stays-ph/property/solea-mactan/templates');
    await templatesReady;

    /* `^` keeps this off the row's own "Actions for Welcome Note" trigger. */
    await page
      .getByRole('complementary', { name: 'Templates' })
      .getByRole('button', { name: /^Welcome Note/ })
      .click();

    const pane = page.getByRole('region', { name: 'Template editor' });
    await expect(pane.getByRole('heading', { name: 'Welcome Note' })).toBeVisible({
      timeout: 20_000,
    });

    const sendRequest = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/send-property-custom-template-email') && res.ok()
    );
    await pane.getByRole('button', { name: 'Actions for Welcome Note' }).click();
    await page.getByRole('menuitem', { name: 'Send to guest' }).click();
    await page.getByText('Jane Guest').click();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await sendRequest;

    await expect(page.getByText('Sent to Jane Guest')).toBeVisible();
  });

  test('property team page loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    const teamReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/property-team-members') && res.ok()
    );
    await page.goto(teamRbacPaths.team);
    await teamReady;
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('property public pages shell loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.publicPages);
    await expect(page.getByRole('heading', { name: 'Public Pages', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'Design your pages' })).toBeVisible();
  });

  test('free host sees upgrade badge before editing listing page', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access', { freePlan: true });
    await page.goto('/org/sample-stays-ph/property/solea-mactan/public-pages/listing/edit');
    await expect(page.getByRole('heading', { name: /Edit - /i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-tier-badge]').first()).toBeVisible();
  });

  test('activity row opens the in-place detail and Back returns to the feed', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.route('**/functions/v1/list-activity-log*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            nextCursor: null,
            events: [
              {
                id: 'evt-inline-detail',
                createdAt: '2026-11-04T03:00:00.000Z',
                organizationId: 'org-team-e2e-001',
                propertyId: 'property-team-e2e-001',
                parkingId: null,
                scope: 'property',
                actorType: 'org_owner',
                actorUserId: null,
                actorEmail: 'owner@example.com',
                actorDisplayName: 'Property Owner',
                actorRole: 'owner',
                actorMemberId: null,
                action: 'property.settings.updated',
                category: 'settings',
                severity: 'info',
                targetType: null,
                targetId: null,
                targetLabel: null,
                summary: 'Updated property settings',
                changes: null,
                metadata: {},
                ipPrefix: null,
                userAgent: null,
                source: 'dashboard',
                requestId: null,
              },
            ],
          },
        }),
      })
    );

    await page.goto(teamRbacPaths.activity);
    await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: /Updated property settings/ }).click();
    const detailHeading = page.getByRole('heading', { name: 'Updated property settings' });
    await expect(detailHeading).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Back' })).toBeInViewport();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(detailHeading).not.toBeInViewport();
    await expect(page.getByRole('searchbox', { name: 'Search activity' })).toBeInViewport();
  });

  test('property activity log loads', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    const activityReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-activity-log') && res.ok()
    );
    await page.goto(teamRbacPaths.activity);
    await activityReady;
    await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('searchbox', { name: 'Search activity' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByText('No activity in this range.')).toBeVisible();
  });
});
