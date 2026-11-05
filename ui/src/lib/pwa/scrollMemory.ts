/**
 * Remember the scroll offset of the page that is about to reload.
 *
 * A service-worker update applies with `location.reload()`, which normally
 * preserves the route but not nested admin scrollports. Sessions save the
 * offsets on `pagehide`, the next mount of the same path consumes them once, and
 * every other navigation still starts at the top (ScrollToTop).
 *
 * sessionStorage, not localStorage: it is per-tab, like the scroll position, and
 * it dies with the tab.
 */

const KEY_PREFIX = 'gfm:scroll:';
const CONTAINER_SELECTORS = ['[data-admin-content-scroll]', 'main'] as const;

export type SavedScroll = {
  window: number;
  containers: Record<string, number>;
};

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null; // private mode / storage disabled
  }
}

export function saveScrollPosition(pathname: string, doc: Document = document): void {
  const store = storage();
  if (!store) return;
  const containers: Record<string, number> = {};
  for (const selector of CONTAINER_SELECTORS) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el && el.scrollTop > 0) containers[selector] = el.scrollTop;
  }
  const value: SavedScroll = { window: window.scrollY || 0, containers };
  try {
    store.setItem(`${KEY_PREFIX}${pathname}`, JSON.stringify(value));
  } catch {
    // quota / disabled storage: scroll restoration is a nicety
  }
}

/**
 * True only for a real reload (an update applying, or the user pressing refresh).
 * A fresh navigation — even back to a path visited earlier in the tab — must
 * start at the top, which is `ScrollToTop`'s contract.
 */
export function isReloadNavigation(): boolean {
  if (typeof performance === 'undefined') return false;
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return entry?.type === 'reload';
}

/** Read and delete the saved offset for this path. */
export function consumeScrollPosition(pathname: string): SavedScroll | null {
  const store = storage();
  if (!store) return null;
  const key = `${KEY_PREFIX}${pathname}`;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    store.removeItem(key);
    const parsed = JSON.parse(raw) as Partial<SavedScroll>;
    return {
      window: typeof parsed.window === 'number' ? parsed.window : 0,
      containers:
        parsed.containers && typeof parsed.containers === 'object' ? parsed.containers : {},
    };
  } catch {
    return null;
  }
}

/**
 * Apply a saved offset. Instant, never smooth: the user did not navigate.
 *
 * The query cache rehydrates asynchronously after a reload, so the scrollport can
 * be shorter than the target on the first frame. Retry on the next frames until
 * the offset sticks (bounded, so a genuinely short list just stays at its end).
 */
export function applyScrollPosition(
  saved: SavedScroll,
  doc: Document = document,
  attempts = 12
): void {
  if (typeof window === 'undefined') return;
  const tryApply = (remaining: number) => {
    if (saved.window > 0) window.scrollTo({ top: saved.window, left: 0, behavior: 'auto' });
    let retry = false;
    for (const [selector, top] of Object.entries(saved.containers)) {
      const el = doc.querySelector<HTMLElement>(selector);
      if (!el) {
        retry = true;
        continue;
      }
      el.scrollTo({ top, left: 0, behavior: 'auto' });
      if (Math.abs(el.scrollTop - top) > 2) retry = true;
    }
    if (retry && remaining > 0) {
      const next = () => tryApply(remaining - 1);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(next);
      else setTimeout(next, 16);
    }
  };
  tryApply(attempts);
}
