import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'docs/screenshots');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
});
const page = await context.newPage();

async function shot(url, name, waitMs = 3500) {
  console.log('capturing', name, url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: false });
}

const only = process.argv.slice(2);
const shots = [
  ['https://kamespace.com/', 'landing-hero'],
  ['https://kamespace.com/properties', 'properties'],
  ['https://kamespace.com/parkings', 'parkings'],
  ['https://kamespace.com/for-hosts', 'for-hosts'],
  ['https://kamespace.com/for-hosts/pricing', 'pricing'],
  ['https://kamespace.com/sign-in', 'sign-in'],
];

for (const [url, name] of shots) {
  if (only.length && !only.includes(name)) continue;
  await shot(url, name);
}

if (!only.length || only.includes('property-listing')) {
  await page.goto('https://kamespace.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const propHref = await page.evaluate(() => {
    const anchors = [...document.querySelectorAll('a[href]')];
    const preferred = anchors.find((a) => {
      const href = a.getAttribute('href') || '';
      return (
        href.includes('/calendar') ||
        href.match(/\/properties\/[^/]+/) ||
        href.match(/\/p\/[^/]+/) ||
        href.match(/\/stay\/[^/]+/)
      );
    });
    return preferred?.getAttribute('href') || null;
  });
  console.log('property link', propHref);
  if (propHref) {
    const url = propHref.startsWith('http') ? propHref : `https://kamespace.com${propHref}`;
    await shot(url, 'property-listing', 4000);
  }
}

await browser.close();
console.log('done →', out);
