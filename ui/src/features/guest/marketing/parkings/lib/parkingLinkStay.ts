/**
 * Persist stay-scoped marketplace deep links across browse → detail → Reserve/form.
 * URL `?linkStay=` is captured once; sessionStorage keeps it without polluting every listing URL.
 */

import { GUEST_PARKING_LINK_STAY_PARAM } from '@/features/guest/lib/guestPublicPaths';

const STORAGE_KEY = 'kame.parking.linkStay';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isParkingLinkStayId(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value.trim()));
}

export function readParkingLinkStayFromSearch(
  search: URLSearchParams | string | null | undefined
): string | null {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : (search ?? new URLSearchParams());
  const raw = (params.get(GUEST_PARKING_LINK_STAY_PARAM) ?? '').trim();
  return isParkingLinkStayId(raw) ? raw : null;
}

export function captureParkingLinkStayFromSearch(
  search: URLSearchParams | string | null | undefined
): string | null {
  const id = readParkingLinkStayFromSearch(search);
  if (!id || typeof sessionStorage === 'undefined') return id;
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode / quota — in-memory URL still works on the landing page */
  }
  return id;
}

export function getParkingLinkStayId(search?: URLSearchParams | string | null): string | null {
  const fromUrl = readParkingLinkStayFromSearch(search);
  if (fromUrl) {
    captureParkingLinkStayFromSearch(search);
    return fromUrl;
  }
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const stored = (sessionStorage.getItem(STORAGE_KEY) ?? '').trim();
    return isParkingLinkStayId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function clearParkingLinkStayId(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
