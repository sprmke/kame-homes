import type { AnalyticsAppTrack, AnalyticsEnvironment } from '@/lib/posthog/types';

export function detectAnalyticsEnvironment(): AnalyticsEnvironment {
  if (import.meta.env.DEV) return 'local';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host.includes('dev.kamehomes.space') || host.includes('vercel.app')) return 'preview';
  return 'production';
}

/** Multi-tenant track — legacy prod uses `legacy` when explicitly flagged. */
export function detectAppTrack(): AnalyticsAppTrack {
  const flag = (import.meta.env.VITE_APP_TRACK as string | undefined)?.trim().toLowerCase();
  if (flag === 'legacy') return 'legacy';
  return 'mt';
}

export function resolvePostHogApiHost(): string | undefined {
  const ingestPath = (import.meta.env.VITE_POSTHOG_INGEST_PATH as string | undefined)?.trim();
  const absoluteHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim();
  if (import.meta.env.PROD && ingestPath) return ingestPath;
  return absoluteHost;
}
