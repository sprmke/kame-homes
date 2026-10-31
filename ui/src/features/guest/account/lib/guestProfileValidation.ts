import { validatePhilippineMobilePhone } from '@/lib/validation/fieldValidation';

/** Optional phone — validate format only when non-empty. */
export function guestProfilePhoneError(value: string): string | null {
  if (!value.trim()) return null;
  return validatePhilippineMobilePhone(value);
}

export function isGuestProfileDraftValid(draft: { phone: string }): boolean {
  return guestProfilePhoneError(draft.phone) === null;
}
