/** Yield so the browser can handle input/paint before heavy thumbnail work. */
export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 120 });
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

/** Wait until after first paint and a short idle window before background work. */
export function waitForMarketingIdle(ms = 250): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, ms);
      });
    });
  });
}
