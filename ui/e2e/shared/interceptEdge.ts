import type { Page, Route } from '@playwright/test';

export type EdgeMock = {
  /** Function name segment after `/functions/v1/` */
  name: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS';
  status?: number;
  body?: unknown;
  /** When set, invoked instead of default JSON body. */
  handler?: (route: Route) => Promise<void>;
};

function matchFunctionName(url: string, name: string): boolean {
  return url.includes(`/functions/v1/${name}`);
}

/**
 * Register Playwright route handlers for Supabase edge functions.
 * Call before `page.goto`.
 */
export async function mockEdgeFunctions(page: Page, mocks: EdgeMock[]) {
  await page.route('**/functions/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const mock = mocks.find(
      (m) => matchFunctionName(url, m.name) && (!m.method || m.method === method)
    );
    if (!mock) {
      await route.continue();
      return;
    }
    if (mock.handler) {
      await mock.handler(route);
      return;
    }
    await route.fulfill({
      status: mock.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(mock.body ?? {}),
    });
  });
}
