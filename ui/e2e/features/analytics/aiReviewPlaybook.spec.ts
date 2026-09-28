/**
 * AI review -> Improvement Playbook hand-off. A "Playbook: …" tip expands the matching article
 * in the card below instead of only jumping to it, and deep-link CTAs name their destination page.
 * Analyze/Refresh is only available on the current week/month/year and follows the selected range.
 */

import { expect, test } from '@playwright/test';

import {
  analyticsPaths,
  installAnalyticsAiReviewMocks,
  openAiReviewTab,
  PLAYBOOK_BLOCKED_DATES,
} from './shared/aiReviewHarness';

function manilaNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentWeekQuery(): string {
  const now = manilaNow();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `?from=${isoDate(start)}&to=${isoDate(end)}`;
}

test.describe('@ci analytics AI review', () => {
  test('deep-link CTA names its destination page', async ({ page }) => {
    await installAnalyticsAiReviewMocks(page);
    await openAiReviewTab(page);

    const cta = page.getByRole('link', { name: 'Go to Pricing' }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', analyticsPaths.pricing);
    await expect(page.getByRole('link', { name: 'Go there' })).toHaveCount(0);
  });

  test('playbook tip expands the matching article', async ({ page }) => {
    await installAnalyticsAiReviewMocks(page);
    await openAiReviewTab(page);

    const articleBody = page.getByText(PLAYBOOK_BLOCKED_DATES.bodyMd);
    await expect(articleBody).toBeHidden();

    await page.getByRole('button', { name: `Playbook: ${PLAYBOOK_BLOCKED_DATES.title}` }).click();

    await expect(articleBody).toBeVisible();
    await expect(
      page.getByRole('button', { name: new RegExp(PLAYBOOK_BLOCKED_DATES.title) }).last()
    ).toHaveAttribute('aria-expanded', 'true');
  });

  test('shows Refresh on the current period', async ({ page }) => {
    await installAnalyticsAiReviewMocks(page);
    await openAiReviewTab(page);

    await expect(
      page.getByRole('button', { name: 'Refresh AI review for this month' })
    ).toBeVisible();
    await expect(page.getByText('Current period only')).toHaveCount(0);
  });

  test('shows Analyze when the selected current week has no matching review', async ({ page }) => {
    await installAnalyticsAiReviewMocks(page);
    await openAiReviewTab(page, currentWeekQuery());

    await expect(page.getByRole('button', { name: 'Analyze this week' })).toBeVisible();
    await expect(page.getByText('No review for this week')).toBeVisible();
    await expect(page.getByText('Occupancy cooled after a full August')).toHaveCount(0);
  });

  test('renders the full dashboard with little booking history', async ({ page }) => {
    await installAnalyticsAiReviewMocks(page, { sampleSize: 5 });
    await page.goto(analyticsPaths.analytics);

    await expect(page.getByRole('tab', { name: 'AI review' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Not enough booking history yet')).toHaveCount(0);
  });

  test('shows not applicable for a prior month', async ({ page }) => {
    await installAnalyticsAiReviewMocks(page);
    await openAiReviewTab(page, '?from=2026-08-01&to=2026-08-31');

    await expect(page.getByText('Current period only')).toBeVisible();
    await expect(page.getByText('Pick this week, this month, or this year.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyze|Refresh AI review/i })).toHaveCount(0);
  });
});
