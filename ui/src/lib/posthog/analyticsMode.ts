import type { AnalyticsMode } from '@/lib/posthog/types';

const STORAGE_KEY = 'gfm:analytics_mode';

const VALID: AnalyticsMode[] = ['full', 'sampled', 'errors_only', 'off'];

function compiledDefault(): AnalyticsMode {
  return import.meta.env.PROD ? 'sampled' : 'full';
}

export function getAnalyticsMode(): AnalyticsMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim().toLowerCase();
    if (raw && VALID.includes(raw as AnalyticsMode)) return raw as AnalyticsMode;
  } catch {
    // private mode
  }
  return compiledDefault();
}

export function setAnalyticsMode(mode: AnalyticsMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export function shouldCaptureProductEvents(): boolean {
  const mode = getAnalyticsMode();
  return mode === 'full' || mode === 'sampled';
}

export function shouldAutocapture(): boolean {
  return getAnalyticsMode() === 'full';
}
