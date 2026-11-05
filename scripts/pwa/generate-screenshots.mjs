#!/usr/bin/env node
/**
 * PWA install-dialog screenshots (`manifest.screenshots`).
 *
 * Android and desktop Chrome show the "rich" install dialog (screenshots +
 * description) only when the manifest declares them; without them the plain
 * dialog appears (P1-12).
 *
 * These are generated brand frames, not live captures: they are the right size
 * and format so the rich dialog renders, and they are deterministic in CI.
 * Replace them with real dashboard captures (same file names) when the seeded
 * screenshot harness lands — see the PWA v2 plan, task 1.16.
 *
 *   node scripts/pwa/generate-screenshots.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(repoRoot, 'ui/public/screenshots');

const BRAND = { from: '#1f9e88', to: '#12705f' };
const INK = '#ffffff';
const MUTED = 'rgba(255,255,255,0.72)';

const SHOTS = [
  {
    file: 'pwa-bookings-narrow.png',
    width: 1080,
    height: 1920,
    title: 'Bookings',
    subtitle: "Today's check-ins and arrivals",
  },
  {
    file: 'pwa-inbox-narrow.png',
    width: 1080,
    height: 1920,
    title: 'Guest Inbox',
    subtitle: 'Every conversation in one place',
  },
  {
    file: 'pwa-dashboard-narrow.png',
    width: 1080,
    height: 1920,
    title: 'Property overview',
    subtitle: 'Occupancy, revenue and tasks',
  },
  {
    file: 'pwa-dashboard-wide.png',
    width: 1920,
    height: 1080,
    title: 'Property overview',
    subtitle: 'Occupancy, revenue and tasks',
  },
];

function frame({ width, height, title, subtitle }) {
  const titleSize = Math.round(Math.min(width, height) * 0.062);
  const subtitleSize = Math.round(Math.min(width, height) * 0.03);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${BRAND.from}"/>
        <stop offset="100%" stop-color="${BRAND.to}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <text x="50%" y="46%" text-anchor="middle" fill="${INK}"
      font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700"
      font-size="${titleSize}">${title}</text>
    <text x="50%" y="46%" dy="${Math.round(titleSize * 1.6)}" text-anchor="middle" fill="${MUTED}"
      font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${subtitleSize}">${subtitle}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const shot of SHOTS) {
    const buffer = await frame(shot);
    const dest = path.join(OUT_DIR, shot.file);
    await sharp(buffer).toFile(dest);
    console.log(`  wrote ${path.relative(repoRoot, dest)} (${buffer.length} bytes)`);
  }
  console.log('PWA install screenshots generated.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
