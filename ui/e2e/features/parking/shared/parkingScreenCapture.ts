import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

const SCREEN_TMP_ROOT = path.resolve(process.cwd(), 'ui/screen-tmp/parking-e2e');

const captureEnabled = process.env.PLAYWRIGHT_CAPTURE_SCREENS === '1';
let currentSuite = 'default';
let stepCounter = 0;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isParkingScreenCaptureEnabled(): boolean {
  return captureEnabled;
}

export function setParkingScreenSuite(name: string) {
  currentSuite = slugify(name);
  stepCounter = 0;

  if (!captureEnabled) return;

  const dir = path.join(SCREEN_TMP_ROOT, currentSuite);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

export async function captureParkingScreen(
  page: Page,
  step: string,
  options?: { role?: 'guest' | 'host'; fullPage?: boolean }
) {
  if (!captureEnabled) return;

  stepCounter += 1;
  const rolePrefix = options?.role ? `${options.role}-` : '';
  const filename = `${String(stepCounter).padStart(2, '0')}-${rolePrefix}${slugify(step)}.png`;
  const dir = path.join(SCREEN_TMP_ROOT, currentSuite);

  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, filename),
    fullPage: options?.fullPage ?? true,
  });
}

export function parkingScreenTmpRoot(): string {
  return SCREEN_TMP_ROOT;
}
