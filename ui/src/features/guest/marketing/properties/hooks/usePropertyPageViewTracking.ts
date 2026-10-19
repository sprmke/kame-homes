import { useEffect } from 'react';

import { buildPropertyPageViewRequest } from '@/features/guest/marketing/properties/lib/propertyPageViewRequest';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_STORAGE_KEY = 'kh_pv_session_id';

function readOrCreateSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    // Private browsing / storage blocked — a fresh id per visit is a fine fallback.
    return crypto.randomUUID();
  }
}

function utmParam(name: string): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fire-and-forget pageview beacon for the public property page — Host Analytics Phase 2b.
 * Never blocks render, never throws, no PII (session id is a random client-generated UUID).
 */
export function usePropertyPageViewTracking(propertyId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !propertyId || !FUNCTIONS_URL || !ANON_KEY) return;

    const [url, init] = buildPropertyPageViewRequest(FUNCTIONS_URL, ANON_KEY, {
      propertyId,
      sessionId: readOrCreateSessionId(),
      referrer: document.referrer || undefined,
      utmSource: utmParam('utm_source'),
      utmMedium: utmParam('utm_medium'),
      utmCampaign: utmParam('utm_campaign'),
    });

    fetch(url, init).catch(() => {
      // Best-effort — never surface a tracking failure to the guest.
    });
    // Only fire once per property mount, not on every referrer/param change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, enabled]);
}
