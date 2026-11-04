import { expect, test } from '@playwright/test';

/**
 * PWA foundation checks, run against a production build where the service worker
 * is real (the `pwa` project in `playwright.config.ts`).
 *
 * Meets the exit criteria that cannot be checked in a unit test: installability,
 * the launch resolver, and the shell-only precache.
 */
test.describe('@pwa installability and lifecycle', () => {
  test('the manifest is installable and self-consistent', async ({ page, request }) => {
    await page.goto('/');

    const href = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(href, 'the document must link a manifest').toBeTruthy();

    const response = await request.get(href!);
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as {
      id: string;
      start_url: string;
      scope: string;
      display: string;
      orientation?: string;
      name: string;
      short_name: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
      screenshots: Array<{ src: string; sizes: string; form_factor: string }>;
      shortcuts: Array<{ url: string; icons: Array<{ src: string }> }>;
    };

    expect(manifest.id).toBe('/?app');
    expect(manifest.start_url.startsWith('/app')).toBe(true);
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBeUndefined();
    expect(manifest.name).toBe(manifest.short_name);

    // Every asset the install dialog fetches must exist.
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.ok(), icon.src).toBe(true);
    }
    for (const screenshot of manifest.screenshots) {
      const shotResponse = await request.get(screenshot.src);
      expect(shotResponse.ok(), screenshot.src).toBe(true);
    }
    for (const shortcut of manifest.shortcuts) {
      expect(shortcut.url.startsWith('/app?shortcut=')).toBe(true);
      for (const icon of shortcut.icons) {
        const iconResponse = await request.get(icon.src);
        expect(iconResponse.ok(), icon.src).toBe(true);
      }
    }
  });

  test('the service worker registers, controls the page and precaches only the shell', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
      timeout: 30_000,
    });

    const tierReport = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const cacheNames = await caches.keys();
      return { registrations: registrations.length, cacheNames };
    });
    expect(tierReport.registrations).toBeGreaterThan(0);

    const precacheNames = tierReport.cacheNames.filter((name) => name.includes('precache'));
    expect(precacheNames.length).toBeGreaterThan(0);

    const cachedUrls = await page.evaluate(async (names) => {
      const urls: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
      }
      return urls;
    }, precacheNames);

    // The shell must be there…
    expect(cachedUrls).toContain('/index.html');
    // …and the heavy editor / PDF / video chunks must not be (P0-2).
    const onDemand = cachedUrls.filter((url) =>
      /PolotnoDesignStudio|mediabunny|pdf\.worker|html2canvas|browser-image-compression/.test(url)
    );
    expect(onDemand).toEqual([]);
  });

  test('the first-launch welcome never covers a browser tab', async ({ page }) => {
    await page.goto('/');
    // Regression: it used to open for every new visitor because it keyed off
    // `firstLaunchSeen` alone. Only an installed (standalone) launch may show it.
    await expect(page.getByRole('heading', { name: /Welcome to/i })).toHaveCount(0);
  });

  test('the launch resolver sends a signed-out visitor to the public landing page', async ({
    page,
  }) => {
    await page.goto('/app?source=pwa');
    await expect(page).toHaveURL(/\/$/);
  });

  test('a manifest shortcut without a session does not crash the app', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/app?shortcut=checkins');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('an offline deep link renders the shell instead of a browser error', async ({
    context,
    page,
  }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
      timeout: 30_000,
    });

    await context.setOffline(true);
    await page.goto('/properties/does-not-exist/form').catch(() => undefined);
    // The shell HTML arrives from the precache; the app still has to mount before body has
    // text. Offline that mount waits out the navigation network timeout, so poll instead of
    // reading innerText once — in CI the single read landed before React painted.
    await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, {
      timeout: 30_000,
    });
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toContain('ERR_INTERNET_DISCONNECTED');
    await context.setOffline(false);
  });

  test('Cache Storage never holds a response from a non-allowlisted function', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
      timeout: 30_000,
    });
    // Public pages the SW is allowed to cache (public* functions only).
    await page.goto('/properties/does-not-exist/form').catch(() => undefined);

    const cachedApiPaths = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(request.url);
      }
      return urls
        .filter((url) => url.includes('/functions/v1/'))
        .map((url) => new URL(url).pathname);
    });

    const allowlisted = /\/(get-public-|list-public-|search-|get-booked-dates|get-residence-unit-types)/;
    const offenders = cachedApiPaths.filter((path) => !allowlisted.test(path));
    expect(offenders).toEqual([]);
  });

  test('the offline page is served when the shell is unavailable', async ({ request }) => {
    const response = await request.get('/offline.html');
    expect(response.ok()).toBe(true);
    const html = await response.text();
    // No inline handlers or inline scripts: the CSP is `script-src 'self'`, so the
    // buttons must be wired from a same-origin file (P1-2).
    expect(html).not.toMatch(/onclick=/i);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
  });
});
