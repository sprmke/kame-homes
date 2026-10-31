/**
 * Low-spec devices skip headless template renders (Polotno / Remotion) for card art and
 * show a themed outline instead; the real thumbnail renders only for the card the host
 * points at. Signals: little memory, few cores, or Data Saver.
 */

type NavigatorSignals = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean };
};

/**
 * `undefined` means "signals unknown" (full mode). Callers that want the live
 * browser signals pass `readNavigator()` through `marketingLowSpecMode`.
 */
export function isLowSpecDevice(nav: NavigatorSignals | undefined): boolean {
  if (!nav) return false;
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true;
  return false;
}

function readNavigator(): NavigatorSignals | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as unknown as NavigatorSignals);
}

let cached: boolean | null = null;

/** Memoized for the session (signals do not change while the page is open). */
export function marketingLowSpecMode(): boolean {
  if (cached === null) cached = isLowSpecDevice(readNavigator());
  return cached;
}
