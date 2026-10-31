import type { GuestNavState } from '@/layouts/guest/navState';

const STORAGE_KEY = 'kame_guest_auth_resume';

export type GuestAuthResume =
  | { type: 'navigate'; to: string; navState?: GuestNavState }
  | {
      type: 'contact_host_sheet';
      propertySlug?: string;
      parkingSlug?: string;
      checkInDate?: string;
      checkOutDate?: string;
      draft?: string;
    }
  | {
      type: 'booking_form_modal';
      propertySlug: string;
      checkInDate?: string;
      checkOutDate?: string;
      adults?: number;
      children?: number;
    }
  | {
      type: 'parking_booking_form_modal';
      parkingSlug: string;
      checkInDate?: string;
      checkOutDate?: string;
    }
  | { type: 'form_submit' }
  | { type: 'save_property'; propertySlug: string };

export const CONTACT_HOST_DRAFT_STORAGE_KEY = 'kame_contact_host_draft';

export function saveContactHostDraft(draft: string): void {
  const trimmed = draft.trim();
  if (!trimmed) {
    sessionStorage.removeItem(CONTACT_HOST_DRAFT_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(CONTACT_HOST_DRAFT_STORAGE_KEY, trimmed);
}

export function takeContactHostDraft(): string {
  const draft = sessionStorage.getItem(CONTACT_HOST_DRAFT_STORAGE_KEY)?.trim() ?? '';
  sessionStorage.removeItem(CONTACT_HOST_DRAFT_STORAGE_KEY);
  return draft;
}

export function saveGuestAuthResume(resume: GuestAuthResume): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
}

export function peekGuestAuthResume(): GuestAuthResume | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestAuthResume;
  } catch {
    return null;
  }
}

export function takeGuestAuthResume(): GuestAuthResume | null {
  const resume = peekGuestAuthResume();
  sessionStorage.removeItem(STORAGE_KEY);
  return resume;
}

export function hasGuestAuthResume(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) !== null;
}

export function clearGuestAuthResume(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
