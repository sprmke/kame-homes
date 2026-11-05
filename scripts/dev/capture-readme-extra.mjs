import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'docs/screenshots');

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
).newPage();

async function shot(url, name, wait = 5000) {
  console.log(name, url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: false });
}

await shot('https://kamespace.com/properties/kame-home', 'property-listing', 10000);

for (const path of [
  '/properties/kame-home/calendar',
  '/properties/kame-home/book',
  '/calendar?property=kame-home',
]) {
  const res = await page
    .goto(`https://kamespace.com${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    .catch(() => null);
  const title = await page.title();
  const text = await page.evaluate(() => document.body?.innerText?.slice(0, 180));
  console.log(path, res?.status(), title, JSON.stringify(text)?.slice(0, 140));
  if (res?.ok() && !/404|not found/i.test(title + text)) {
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: join(out, `property-${path.split('/').pop().split('?')[0] || 'page'}.png`),
      fullPage: false,
    });
  }
}

await page.goto('https://kamespace.com/for-hosts', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4500);
await page.evaluate(() => window.scrollTo(0, 1100));
await page.waitForTimeout(2000);
await page.screenshot({ path: join(out, 'for-hosts-tour.png'), fullPage: false });
await page.evaluate(() => window.scrollTo(0, 2600));
await page.waitForTimeout(2000);
await page.screenshot({ path: join(out, 'for-hosts-features.png'), fullPage: false });
await page.evaluate(() => window.scrollTo(0, 4200));
await page.waitForTimeout(2000);
await page.screenshot({ path: join(out, 'for-hosts-modules.png'), fullPage: false });

await browser.close();
console.log('done');
