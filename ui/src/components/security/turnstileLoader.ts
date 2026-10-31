/**
 * Single-load injector for the Cloudflare Turnstile script.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 1)
 *
 * Mirrors the "load once, share the promise" pattern used by the Google Maps
 * loader (`ui/src/lib/google-maps/useGoogleMapsLoader.ts`). The script is only
 * requested when a widget actually mounts, never at app boot.
 */

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LOAD_TIMEOUT_MS = 8_000;

export type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: (error?: unknown) => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'flexible' | 'normal' | 'compact';
  appearance?: 'always' | 'execute' | 'interaction-only';
  action?: string;
  retry?: 'auto' | 'never';
  'refresh-expired'?: 'auto' | 'manual' | 'never';
};

export type TurnstileApi = {
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId?: string) => string | undefined;
  execute: (container?: HTMLElement | string, options?: Partial<TurnstileRenderOptions>) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loadPromise: Promise<TurnstileApi> | null = null;

export function getTurnstileSiteKey(): string {
  return (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? '';
}

export function isTurnstileConfigured(): boolean {
  return getTurnstileSiteKey().length > 0;
}

/**
 * Resolves with `window.turnstile` once the script is ready. Rejects on network
 * failure or a load timeout — callers treat a rejection as "degrade to
 * heuristics + rate limit", never as a hard block.
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile unavailable (no window)'));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);

    const settle = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        loadPromise = null;
        reject(new Error('Turnstile script loaded without window.turnstile'));
      }
    };

    const timer = window.setTimeout(() => {
      loadPromise = null;
      reject(new Error('Turnstile script load timed out'));
    }, LOAD_TIMEOUT_MS);

    const onLoad = () => {
      window.clearTimeout(timer);
      settle();
    };
    const onError = () => {
      window.clearTimeout(timer);
      loadPromise = null;
      reject(new Error('Turnstile script failed to load'));
    };

    if (existing) {
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', onError, { once: true });
      // Script tag already present and possibly already executed.
      if (window.turnstile) onLoad();
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  });

  return loadPromise;
}
