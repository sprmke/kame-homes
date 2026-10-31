#!/usr/bin/env node
/**
 * PWA icon generator — deterministic, checked-in output.
 *
 * Source of truth: ui/public/favicon/web-app-manifest-512x512.png (full-bleed brand mark).
 * Produces the icon set the web app manifest + notification badge reference:
 *
 *   ui/public/icons/pwa-192.png              any-purpose, 192×192
 *   ui/public/icons/pwa-512.png              any-purpose, 512×512
 *   ui/public/icons/pwa-maskable-192.png     maskable, brand-gradient safe zone
 *   ui/public/icons/pwa-maskable-512.png     maskable, brand-gradient safe zone
 *   ui/public/icons/apple-touch-icon.png     180×180, opaque (iOS home screen)
 *   ui/public/icons/notification-badge.png   96×96 monochrome silhouette (Android status bar)
 *
 * Re-run after changing the source mark:  node scripts/pwa/generate-icons.mjs
 * `sharp` is a root devDependency; this never runs in the browser bundle or CI build.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(repoRoot, 'ui/public/favicon/web-app-manifest-512x512.png');
const OUT_DIR = path.join(repoRoot, 'ui/public/icons');

// Solid brand background for padded (maskable / Apple) icons — sampled from the
// source mark's dominant tone. Solid (not gradient) so there is no seam where the
// scaled-down source mark sits on top of it.
const BRAND_BG = { r: 0xe7, g: 0xc9, b: 0x8d, alpha: 1 };

/** Solid brand-background square as a PNG buffer. */
function brandSquare(size) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_BG },
  }).png();
}

async function anyIcon(size) {
  return sharp(SRC).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * Maskable: the mark scaled into the inner 80% (Android/iOS mask can crop up to
 * the outer ~10% on each edge, plus corner rounding), on the brand gradient.
 */
async function maskableIcon(size) {
  // Mark at 66% on a solid brand square: comfortably inside the maskable safe
  // circle (radius 40% from centre) on every launcher shape, no seam.
  const inner = Math.round(size * 0.66);
  const mark = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return (await brandSquare(size))
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function appleTouchIcon() {
  // iOS ignores transparency and applies its own rounded mask — ship an opaque 180².
  const mark = await sharp(SRC)
    .resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return (await brandSquare(180))
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Notification badge (Android): a flat white silhouette on transparency. Derive
 * alpha from the mark's luminance so the bold outlines read as the shape.
 */
async function notificationBadge() {
  const size = 96;
  const { data, info } = await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const r = data[i * info.channels];
    const g = data[i * info.channels + 1];
    const b = data[i * info.channels + 2];
    const a = info.channels === 4 ? data[i * info.channels + 3] : 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Opaque white only on the mark's bold dark linework — the tan/sage fills
    // (lum ~190-205) must stay transparent or the badge is a solid blob.
    const shape = a > 40 && lum < 110 ? 255 : 0;
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = shape;
  }
  return sharp(out, { raw: { width: size, height: size, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const jobs = [
    ['pwa-192.png', await anyIcon(192)],
    ['pwa-512.png', await anyIcon(512)],
    ['pwa-maskable-192.png', await maskableIcon(192)],
    ['pwa-maskable-512.png', await maskableIcon(512)],
    ['apple-touch-icon.png', await appleTouchIcon()],
    ['notification-badge.png', await notificationBadge()],
  ];
  for (const [name, buf] of jobs) {
    const dest = path.join(OUT_DIR, name);
    // eslint-disable-next-line no-await-in-loop
    await sharp(buf).toFile(dest);
    console.log(`  wrote ${path.relative(repoRoot, dest)} (${buf.length} bytes)`);
  }
  console.log('PWA icons generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
