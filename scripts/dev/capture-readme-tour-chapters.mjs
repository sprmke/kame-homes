import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'docs/screenshots');

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
).newPage();

await page.goto('https://kamespace.com/for-hosts', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

// Scroll tour into view
await page.evaluate(() => {
  const el =
    document.querySelector('#features') ||
    document.querySelector('[data-tour]') ||
    [...document.querySelectorAll('button, a')].find((n) => /Dashboard|Bookings|Setup/i.test(n.textContent || ''));
  el?.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(2000);

const chapters = ['Dashboard', 'Bookings', 'Board', 'Inbox', 'Marketing', 'Pricing', 'Finance', 'AI'];
for (const label of chapters) {
  const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  const visible = await btn.isVisible().catch(() => false);
  console.log(label, 'visible?', visible);
  if (!visible) continue;
  await btn.click().catch(() => {});
  await page.waitForTimeout(2500);
  // Screenshot the tour player region if possible
  const player = page.locator('video, canvas, [data-tour-player], [class*="Player"]').first();
  const box = await player.boundingBox().catch(() => null);
  if (box && box.width > 400) {
    await page.screenshot({
      path: join(out, `host-${label.toLowerCase().replace(/\s+/g, '-')}.png`),
      clip: {
        x: Math.max(0, box.x - 24),
        y: Math.max(0, box.y - 48),
        width: Math.min(1440, box.width + 48),
        height: Math.min(900, box.height + 96),
      },
    });
  } else {
    await page.screenshot({ path: join(out, `host-${label.toLowerCase()}.png`), fullPage: false });
  }
}

await browser.close();
console.log('done');
