import { flushSync } from 'react-dom';

/**
 * Runs a mode-switch state update inside `document.startViewTransition` when the browser has it
 * (Chrome, Edge, Safari 18+). Returns false when it is unsupported so the caller can fall back to
 * framer-motion layout animation. Styles live in index.css under `html[data-mode-transition]`.
 */
export function runModeViewTransition(
  update: () => void,
  options: { reducedMotion: boolean }
): boolean {
  if (typeof document === 'undefined') return false;
  const start = (
    document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    }
  ).startViewTransition;
  if (typeof start !== 'function') return false;

  const root = document.documentElement;
  root.dataset.modeTransition = options.reducedMotion ? 'reduced' : 'full';
  try {
    const transition = start.call(document, () => {
      flushSync(update);
    });
    void transition.finished.finally(() => {
      delete root.dataset.modeTransition;
    });
    return true;
  } catch {
    delete root.dataset.modeTransition;
    return false;
  }
}
