import { expect, test } from '@playwright/test';

import {
  mockPublicDevelopmentsListBody,
  mockPublicPricingPlansBody,
  mockPublicPropertiesListBody,
  mockPublicPropertyBody,
  mockSearchListingsBody,
  mockSearchSuggestionsBody,
} from '../../shared/mockFixtures';
import { mockEdgeFunctions } from '../../shared/interceptEdge';

test.describe('@smoke @ci public marketing pages', () => {
  test('guest landing loads hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Find your next stay/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('properties list loads from mock API', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-properties', body: mockPublicPropertiesListBody },
    ]);
    const listReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-public-properties') && res.ok()
    );
    await page.goto('/properties?view=list');
    await listReady;
    await expect(page.getByText('Solea Mactan').first()).toBeVisible({ timeout: 20_000 });
  });

  test('for-hosts landing loads hero', async ({ page }) => {
    await page.goto('/for-hosts');
    await expect(page.getByRole('heading', { name: /Run every stay/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('for-hosts pricing loads plan cards', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-pricing-plans', body: mockPublicPricingPlansBody },
    ]);
    await page.goto('/for-hosts/pricing');
    await expect(page.getByRole('heading', { name: 'Plans that grow with you' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
  });

  test('property detail page loads from mock API', async ({ page }) => {
    await mockEdgeFunctions(page, [{ name: 'get-public-property', body: mockPublicPropertyBody }]);
    await page.goto('/properties/solea-mactan');
    await expect(page.getByRole('heading', { name: 'Solea Mactan' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('search page renders', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'search-suggestions', body: mockSearchSuggestionsBody },
      { name: 'search-listings', body: mockSearchListingsBody },
    ]);
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('developments list loads from mock API', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-developments', body: mockPublicDevelopmentsListBody },
    ]);
    const listReady = page.waitForResponse(
      (res) => res.url().includes('/functions/v1/list-public-developments') && res.ok()
    );
    await page.goto('/developments?view=list');
    await listReady;
    await expect(page.getByText('Solea Residences').first()).toBeVisible({ timeout: 20_000 });
  });

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible({
      timeout: 15_000,
    });
  });
});
