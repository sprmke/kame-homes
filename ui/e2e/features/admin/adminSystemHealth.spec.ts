import { expect, test } from '@playwright/test';

import { installSystemHealthMocks } from './shared/adminSystemHealthHarness';
import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';

test.describe('@ci super admin system health', () => {
  test('@smoke overview lists issues worst first with no layout overflow', async ({ page }) => {
    await installSystemHealthMocks(page);
    await page.goto('/admin/health');
    await expect(page.getByRole('heading', { name: 'System health', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const issues = page.getByRole('region', { name: 'Issues' });
    await expect(issues.getByText('RESEND_API_KEY')).toBeVisible();
    await expect(issues.getByText('Calendar sync')).toBeVisible();
    await expect(issues.getByText('Gemini', { exact: true })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);
  });

  test('configuration filter narrows to issues', async ({ page }) => {
    await installSystemHealthMocks(page);
    await page.goto('/admin/health/configuration');
    await expect(page.getByText('SUPABASE_URL').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /Issues/ }).click();
    await expect(page.getByText('RESEND_API_KEY')).toBeVisible();
    await expect(page.getByText('SUPABASE_URL', { exact: true })).toHaveCount(0);
  });

  test('integrations include AI reliability flags', async ({ page }) => {
    await installSystemHealthMocks(page);
    await page.goto('/admin/health/integrations');
    await expect(page.getByRole('region', { name: 'AI reliability (30 days)' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('High error rate. Check provider keys and quotas.')).toBeVisible();
  });

  test('jobs and usage sections render', async ({ page }) => {
    await installSystemHealthMocks(page);
    await page.goto('/admin/health/jobs');
    const jobs = page.getByRole('region', { name: 'Scheduled jobs' });
    await expect(jobs.getByText('Failed 4 runs in a row')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('prune-rate-limits')).toBeVisible();

    await page.goto('/admin/health/usage');
    await expect(page.getByText('guest_submissions')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('property-media')).toBeVisible();
    await expect(page.getByRole('region', { name: 'AI by feature' })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test('overview issue deep links to the exact row', async ({ page }) => {
    await installSystemHealthMocks(page);
    await page.goto('/admin/health');
    const issues = page.getByRole('region', { name: 'Issues' });
    await issues.getByRole('link', { name: 'RESEND_API_KEY', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/health\/configuration#check-env-edge-RESEND_API_KEY$/);
    await expect(page.locator('#check-env-edge-RESEND_API_KEY')).toHaveAttribute(
      'data-highlight',
      'true'
    );
  });

  test('configuration search filters keys', async ({ page }) => {
    await installSystemHealthMocks(page);
    await page.goto('/admin/health/configuration');
    await expect(page.getByText('SUPABASE_URL').first()).toBeVisible({ timeout: 20_000 });
    await page.getByPlaceholder('Search keys or features').fill('resend');
    await expect(page.getByText('RESEND_API_KEY')).toBeVisible();
    await expect(page.getByText('SUPABASE_URL', { exact: true })).toHaveCount(0);
  });

  test('integration issues show manage, check now and affected items', async ({ page }) => {
    const posts = await installSystemHealthMocks(page);
    await page.goto('/admin/health/integrations');
    const gemini = page.locator('#check-probe-gemini');
    await expect(gemini.getByRole('link', { name: /Manage/ })).toHaveAttribute(
      'href',
      'https://aistudio.google.com/apikey'
    );
    await expect(page.getByRole('link', { name: 'Casa Azul Facebook' })).toHaveAttribute(
      'href',
      '/admin/orgs/casa-azul'
    );
    await gemini.getByRole('button', { name: /Check now/ }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ action: 'run_probes', probes: ['gemini'] });
  });

  test('failing job links to its logs', async ({ page }) => {
    await installSystemHealthMocks(page);
    await page.goto('/admin/health/jobs');
    await expect(
      page.locator('#check-job-calendar-sync-cron').getByRole('link', { name: 'Logs' })
    ).toHaveAttribute('href', /functions\/calendar-sync-cron\/logs$/, { timeout: 20_000 });
  });

  test('run live checks posts one probe request', async ({ page }) => {
    const posts = await installSystemHealthMocks(page);
    await page.goto('/admin/health');
    await page.getByRole('button', { name: 'Run live checks' }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ action: 'run_probes' });
  });
});
