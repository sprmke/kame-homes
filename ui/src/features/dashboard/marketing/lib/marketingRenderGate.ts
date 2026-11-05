/**
 * Background thumbnail renders (headless Polotno / Remotion stills) wait here while
 * the host is actively working on a canvas, so a card thumbnail never steals the
 * main thread from a drag, a text edit or video playback.
 *
 * Editors call `holdMarketingRenders()` on pointer down / play and `releaseMarketingRenders()`
 * on pointer up / pause; renders resume after a short quiet period.
 */

const QUIET_AFTER_RELEASE_MS = 1200;

let holds = 0;
let releasedAt = 0;
const waiters = new Set<() => void>();
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

function now(): number {
  return Date.now();
}

function isQuiet(): boolean {
  return holds === 0 && now() - releasedAt >= QUIET_AFTER_RELEASE_MS;
}

function scheduleWake(): void {
  if (wakeTimer || holds > 0) return;
  const wait = Math.max(0, QUIET_AFTER_RELEASE_MS - (now() - releasedAt));
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    if (!isQuiet()) {
      scheduleWake();
      return;
    }
    const pending = [...waiters];
    waiters.clear();
    for (const resolve of pending) resolve();
  }, wait);
}

export function holdMarketingRenders(): void {
  holds += 1;
}

export function releaseMarketingRenders(): void {
  holds = Math.max(0, holds - 1);
  releasedAt = now();
  if (waiters.size > 0) scheduleWake();
}

/** Resolves once nobody holds renders and the quiet period has passed. */
export function whenMarketingRendersAllowed(): Promise<void> {
  if (isQuiet()) return Promise.resolve();
  return new Promise((resolve) => {
    waiters.add(resolve);
    scheduleWake();
  });
}

/** Test helper: back to the initial state. */
export function resetMarketingRenderGate(): void {
  holds = 0;
  releasedAt = 0;
  waiters.clear();
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = null;
}
