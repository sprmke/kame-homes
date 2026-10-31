import { expect, test, type Route } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';

/**
 * Public listing browse: server-side pagination, URL state (Back restores the page),
 * server-side parking filters on location pages, and filtered-empty states that keep
 * the guest on the page. Mocks return data shaped by the request's query string.
 */

const EMPTY_PROPERTY_FACETS = {
  types: [],
  price: { min: 0, max: 0 },
  bedrooms: [],
  amenities: [],
  developments: [],
};

function propertyItem(page: number, index: number) {
  return {
    id: `p-${page}-${index}`,
    slug: `home-${page}-${index}`,
    name: `Home ${page}-${index}`,
    type: 'Condo',
    location: 'Makati, Metro Manila',
    price: 2500,
    rating: null,
    reviews: 0,
    images: [],
    guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    amenities: [],
  };
}

function pagedProperties(total: number) {
  return async (route: Route) => {
    const url = new URL(route.request().url());
    const pageSize = Number(url.searchParams.get('pageSize') ?? 24);
    const page = Number(url.searchParams.get('page') ?? 1);
    const count = Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: Array.from({ length: count }, (_, i) => propertyItem(page, i)),
        total,
        page,
        pageSize,
        facets: EMPTY_PROPERTY_FACETS,
      }),
    });
  };
}

test.describe('@ci public listing browse', () => {
  test('filtered properties paginate and Back restores the previous page', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-properties', handler: pagedProperties(60) },
    ]);
    await page.goto('/properties?type=condo&view=list');

    await expect(page.getByText('Home 1-0', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('1 / 3')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByText('Home 2-0', { exact: true })).toBeVisible();
    await expect(page.getByText('2 / 3')).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/[?&]page=/);
    await expect(page.getByText('Home 1-0', { exact: true })).toBeVisible();
  });

  test('parking location page sends filters, sort, and page to the API', async ({ page }) => {
    const requests: URL[] = [];
    await mockEdgeFunctions(page, [
      {
        name: 'list-public-parkings',
        handler: async (route) => {
          const url = new URL(route.request().url());
          requests.push(url);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [
                {
                  id: 'k-1',
                  slug: 'tower-a-slot-1',
                  name: 'Tower A Slot 1',
                  parkingType: 'inside_tower',
                  tower: 'Tower A',
                  slotLabel: 'Slot 1',
                  ratePerNight: 300,
                  features: [],
                  city: 'Taguig',
                },
              ],
              total: 100,
              page: Number(url.searchParams.get('page') ?? 1),
              pageSize: 48,
              facets: {
                locations: [{ location: 'inside_tower', count: 100 }],
                towers: [{ tower: 'Tower A', count: 100 }],
                price: { min: 300, max: 300 },
              },
            }),
          });
        },
      },
    ]);

    await page.goto('/parkings/in/taguig?location=inside_tower&towers=Tower%20A');
    await expect(page.getByText('1 / 3')).toBeVisible({ timeout: 20_000 });

    const first = requests[0]!;
    expect(first.searchParams.get('locationSlug')).toBe('taguig');
    expect(first.searchParams.get('location')).toBe('inside_tower');
    expect(first.searchParams.get('towers')).toBe('Tower A');
    expect(first.searchParams.get('pageSize')).toBe('48');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect
      .poll(() => requests.some((url) => url.searchParams.get('page') === '2'))
      .toBe(true);
    // The route-owned place never leaks into the query string.
    await expect(page).not.toHaveURL(/locationSlug=/);
  });

  test('filters with no matches on a location page keep the guest there', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-properties', handler: pagedProperties(0) },
    ]);
    await page.goto('/properties/in/makati?type=villa');

    await expect(page.getByText('No homes match')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/properties\/in\/makati/);
  });

  test('an unknown place with no filters redirects to the index', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'list-public-properties', handler: pagedProperties(0) },
      {
        name: 'list-public-place-groups',
        body: { success: true, groups: [], total: 0, groupTotal: 0 },
      },
    ]);
    await page.goto('/properties/in/nowhere-at-all');
    await expect(page).toHaveURL(/\/properties$/, { timeout: 20_000 });
  });
});
