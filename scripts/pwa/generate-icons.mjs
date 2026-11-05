#!/usr/bin/env node
/**
 * Brand + PWA asset generator — deterministic, checked-in output.
 *
 * Source of truth: the vector marks in `ui/public/brand/`:
 *
 *   kame-space-mark.svg        rounded square tile + white K (favicon, logo, Google)
 *   kame-space-tile.svg        full-bleed square tile + white K (maskable, Apple, manifest)
 *   kame-space-mark-mono.svg   white K silhouette (monochrome + notification badge)
 *
 * Produces every raster the app references:
 *
 *   ui/public/icons/pwa-192.png / pwa-512.png        any-purpose mark
 *   ui/public/icons/pwa-maskable-192.png / -512.png  full-bleed tile
 *   ui/public/icons/apple-touch-icon.png             180×180 full-bleed tile
 *   ui/public/icons/notification-badge.png           96×96 monochrome K
 *   ui/public/icons/monochrome-512.png               512×512 monochrome K
 *   ui/public/icons/shortcut-*.png                   96×96 shortcut glyphs
 *   ui/public/favicon/favicon-96x96.png              mark
 *   ui/public/favicon/favicon.ico                    16/32/48 ICO
 *   ui/public/favicon/favicon.svg                    copy of the rounded mark
 *   ui/public/favicon/apple-touch-icon.png           180×180 full-bleed tile
 *   ui/public/favicon/web-app-manifest-192x192.png   mark
 *   ui/public/favicon/web-app-manifest-512x512.png   full-bleed tile
 *   ui/public/images/logo.png                        512×512 mark (emails, org fallback)
 *   ui/public/brand/kame-space-mark-120.png          Google OAuth branding upload
 *   ui/public/brand/kame-space-mark-512.png          mark
 *   ui/public/splash/splash-<w>x<h>-<theme>.png      iOS launch screens
 *
 * Re-run after changing a mark:  node scripts/pwa/generate-icons.mjs
 * `sharp` is a root devDependency; this never runs in the browser bundle or CI build.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BRAND_DIR = path.join(repoRoot, 'ui/public/brand');
const MARK_SRC = path.join(BRAND_DIR, 'kame-space-mark.svg');
const TILE_SRC = path.join(BRAND_DIR, 'kame-space-tile.svg');
const MONO_SRC = path.join(BRAND_DIR, 'kame-space-mark-mono.svg');
// Brand token --primary (hsl(168 65% 40%)) for solid backgrounds around the mark.
const BRAND_BG = { r: 0x24, g: 0xa8, b: 0x8e, alpha: 1 };

async function render(source, size, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const svg = await readFile(source);
  return sharp(svg, { density: 144 })
    .resize(size, size, { fit: 'contain', background })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Full-bleed square: used where the launcher/OS applies its own mask. */
async function tile(size) {
  return render(TILE_SRC, size);
}

async function mark(size) {
  return render(MARK_SRC, size);
}

/** Solid brand square as a PNG buffer (shortcut glyphs). */
function brandSquare(size) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_BG },
  }).png();
}

/**
 * iOS launch screens (`apple-touch-startup-image`). Without these iOS paints a
 * blank white window on launch, including in dark mode (P1-11). Each is a solid
 * background with the rounded mark centred, which compresses to a small PNG.
 */
const SPLASH_SIZES = [
  [1320, 2868], // iPhone 16 Pro Max
  [1206, 2622], // iPhone 16 Pro
  [1290, 2796], // iPhone 16 Plus / 15 Plus
  [1179, 2556], // iPhone 16 / 15 / 14 Pro
  [1170, 2532], // iPhone 14 / 13 / 12
  [1125, 2436], // iPhone 13 mini
  [750, 1334], // iPhone SE
  [1640, 2360], // iPad Air 10.9"
  [1668, 2388], // iPad Pro 11"
  [2048, 2732], // iPad Pro 12.9"
];

const SPLASH_THEMES = [
  { name: 'light', bg: '#f5f6f8' },
  { name: 'dark', bg: '#121212' },
];

async function splashScreen(width, height, theme) {
  const size = Math.round(Math.min(width, height) * 0.28);
  const logo = await mark(size);
  return sharp({
    create: { width, height, channels: 4, background: theme.bg },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Shortcut glyphs: a simple white mark on the brand background so the long-press
 * menu is distinguishable, without shipping a second icon set.
 */
async function shortcutIcon(size, kind) {
  const glyph = {
    bookings:
      '<rect x="30" y="42" width="36" height="34" rx="5"/><rect x="38" y="34" width="20" height="8" rx="4"/>',
    inbox:
      '<rect x="28" y="46" width="40" height="28" rx="7"/><path d="M30 50l18 13 18-13" stroke="none"/>',
    checkins:
      '<path d="M40 62l10 10 22-24" fill="none" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
  }[kind];
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">` +
      `<rect width="96" height="96" rx="20" fill="#24A88E"/>` +
      `<g fill="#ffffff" stroke="#ffffff">${glyph}</g></svg>`
  );
  return sharp(svg).png({ compressionLevel: 9 }).toBuffer();
}

/** Build an ICO from PNG buffers (PNG-compressed entries are widely supported). */
function icoFromPngs(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + 16 * entries.length;
  const directory = entries.map(({ size, buf }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buf.length;
    return entry;
  });

  return Buffer.concat([header, ...directory, ...entries.map((e) => e.buf)]);
}

async function writeTo(dest, buf) {
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  console.log(`  wrote ${path.relative(repoRoot, dest)} (${buf.length} bytes)`);
}

async function main() {
  const icons = path.join(repoRoot, 'ui/public/icons');
  const favicon = path.join(repoRoot, 'ui/public/favicon');
  const images = path.join(repoRoot, 'ui/public/images');
  const splashDir = path.join(repoRoot, 'ui/public/splash');

  await writeTo(path.join(icons, 'pwa-192.png'), await mark(192));
  await writeTo(path.join(icons, 'pwa-512.png'), await mark(512));
  await writeTo(path.join(icons, 'pwa-maskable-192.png'), await tile(192));
  await writeTo(path.join(icons, 'pwa-maskable-512.png'), await tile(512));
  await writeTo(path.join(icons, 'apple-touch-icon.png'), await tile(180));
  await writeTo(
    path.join(icons, 'notification-badge.png'),
    await render(MONO_SRC, 96)
  );
  await writeTo(path.join(icons, 'monochrome-512.png'), await render(MONO_SRC, 512));
  await writeTo(path.join(icons, 'shortcut-bookings.png'), await shortcutIcon(96, 'bookings'));
  await writeTo(path.join(icons, 'shortcut-inbox.png'), await shortcutIcon(96, 'inbox'));
  await writeTo(path.join(icons, 'shortcut-checkins.png'), await shortcutIcon(96, 'checkins'));

  await writeTo(path.join(favicon, 'favicon-96x96.png'), await mark(96));
  await writeTo(path.join(favicon, 'apple-touch-icon.png'), await tile(180));
  await writeTo(path.join(favicon, 'web-app-manifest-192x192.png'), await mark(192));
  await writeTo(path.join(favicon, 'web-app-manifest-512x512.png'), await tile(512));
  await writeTo(
    path.join(favicon, 'favicon.svg'),
    await readFile(MARK_SRC)
  );

  const icoEntries = [];
  for (const size of [16, 32, 48]) {
    // eslint-disable-next-line no-await-in-loop
    icoEntries.push({ size, buf: await mark(size) });
  }
  await writeTo(path.join(favicon, 'favicon.ico'), icoFromPngs(icoEntries));

  await writeTo(path.join(images, 'logo.png'), await mark(512));
  await writeTo(path.join(BRAND_DIR, 'kame-space-mark-120.png'), await mark(120));
  await writeTo(path.join(BRAND_DIR, 'kame-space-mark-512.png'), await mark(512));

  for (const [width, height] of SPLASH_SIZES) {
    for (const theme of SPLASH_THEMES) {
      // eslint-disable-next-line no-await-in-loop
      const buf = await splashScreen(width, height, theme);
      // eslint-disable-next-line no-await-in-loop
      await writeTo(
        path.join(splashDir, `splash-${width}x${height}-${theme.name}.png`),
        buf
      );
    }
  }

  console.log('Brand assets generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
