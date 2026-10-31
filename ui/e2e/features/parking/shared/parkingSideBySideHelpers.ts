import { chromium, type Browser, type Page } from '@playwright/test';

export function readPositiveIntEnv(name: string): number {
  const raw = process.env[name];
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function demoPause(...pages: Page[]) {
  const pauseMs = readPositiveIntEnv('PLAYWRIGHT_DEMO_PAUSE_MS');
  if (!pauseMs) return;
  await Promise.all(pages.map((page) => page.waitForTimeout(pauseMs)));
}

export type SideBySideBrowsers = {
  guestBrowser: Browser;
  hostBrowser: Browser;
  guestPage: Page;
  hostPage: Page;
};

export async function launchParkingSideBySideBrowsers(): Promise<SideBySideBrowsers> {
  const slowMo = readPositiveIntEnv('PLAYWRIGHT_SLOW_MO');
  const guestBrowser = await chromium.launch({
    headless: false,
    slowMo,
    args: ['--window-position=0,40', '--window-size=900,980'],
  });
  const hostBrowser = await chromium.launch({
    headless: false,
    slowMo,
    args: ['--window-position=920,40', '--window-size=900,980'],
  });

  const guestContext = await guestBrowser.newContext({ viewport: { width: 900, height: 960 } });
  const hostContext = await hostBrowser.newContext({ viewport: { width: 900, height: 960 } });
  const guestPage = await guestContext.newPage();
  const hostPage = await hostContext.newPage();

  return { guestBrowser, hostBrowser, guestPage, hostPage };
}

export async function closeParkingSideBySideBrowsers(browsers: SideBySideBrowsers) {
  await browsers.guestBrowser.close();
  await browsers.hostBrowser.close();
}

export function sideBySideTimeoutMs(): number {
  const slowMo = readPositiveIntEnv('PLAYWRIGHT_SLOW_MO');
  const demoPauseMs = readPositiveIntEnv('PLAYWRIGHT_DEMO_PAUSE_MS');
  return slowMo || demoPauseMs ? 300_000 : 180_000;
}
