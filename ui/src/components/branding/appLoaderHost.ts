/**
 * Imperative singleton for the full-screen app loader.
 *
 * Suspense + nested route guards remount `<AppLoader>` several times during boot.
 * A React portal remount restarts CSS animations and flashes a blank frame between
 * handoffs. This host stays on `document.body` for as long as any consumer is active
 * (plus a short bridge delay), so the sheen loop keeps running.
 */

import { buildWordmarkWave } from '@/components/branding/appLoaderWordmark';
import { platformMarkInitial, platformWordmarkParts } from '@/lib/platformBranding';

const HOST_ID = 'app-loader-host';
/** Bridges Suspense → RequireAdmin → RequireOrgContext handoffs without a blank flash. */
const HIDE_BRIDGE_MS = 220;

let refCount = 0;
let host: HTMLDivElement | null = null;
let hideTimer: number | undefined;
let wantsFullScreen = false;

function clearHideTimer() {
  if (hideTimer === undefined) return;
  window.clearTimeout(hideTimer);
  hideTimer = undefined;
}

function buildLockupHtml(): string {
  const parts = platformWordmarkParts();
  const initial = platformMarkInitial();
  const words = parts ? buildWordmarkWave(parts) : [];

  const markInner = initial
    ? `<span class="app-loader-mark__initial">${escapeHtml(initial)}</span>`
    : `<span class="app-loader-mark__dot"></span>`;

  const wordmark =
    words.length > 0
      ? `<p class="app-loader-wordmark">${words
          .map(
            (word) =>
              `<span class="app-loader-wordmark__word">${word.chunks
                .map((chunk) => {
                  const accent = word.accent ? ' app-loader-wordmark__letter--accent' : '';
                  return `<span class="app-loader-wordmark__letter${accent}" style="--app-loader-letter-step:${chunk.step}">${escapeHtml(chunk.text)}</span>`;
                })
                .join('')}</span>`
          )
          .join('')}</p>`
      : '';

  return `<div class="app-loader-lockup" aria-hidden="true"><div class="app-loader-mark"><span class="app-loader-mark__tile"><span class="app-loader-mark__sheen"></span>${markInner}</span></div>${wordmark}</div><span class="sr-only">Loading</span>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function syncHostChrome() {
  if (!host) return;
  host.className = wantsFullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-background'
    : 'fixed inset-0 z-50 flex items-center justify-center';
}

function ensureHost() {
  if (typeof document === 'undefined') return;
  if (host) {
    syncHostChrome();
    return;
  }

  const existing = document.getElementById(HOST_ID);
  if (existing instanceof HTMLDivElement) {
    host = existing;
    syncHostChrome();
    return;
  }

  const el = document.createElement('div');
  el.id = HOST_ID;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = buildLockupHtml();
  document.body.appendChild(el);
  host = el;
  syncHostChrome();
}

function teardownHost() {
  if (!host) return;
  host.remove();
  host = null;
  wantsFullScreen = false;
}

/** @internal Exported for tests. */
export function getAppLoaderRefCountForTests(): number {
  return refCount;
}

/** @internal Exported for tests. */
export function resetAppLoaderHostForTests(): void {
  clearHideTimer();
  refCount = 0;
  teardownHost();
}

export function acquireAppLoader(options: { fullScreen?: boolean } = {}): void {
  if (typeof document === 'undefined') return;

  clearHideTimer();
  refCount += 1;
  if (options.fullScreen) wantsFullScreen = true;
  ensureHost();
}

export function releaseAppLoader(): void {
  if (typeof document === 'undefined') return;

  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;

  clearHideTimer();
  hideTimer = window.setTimeout(() => {
    hideTimer = undefined;
    if (refCount === 0) teardownHost();
  }, HIDE_BRIDGE_MS);
}
