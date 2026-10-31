/**
 * Server-side mirror of guestFormSchema.ts format-only rules (production-readiness
 * Phase 2 / cost-abuse Phase 5). Property-config-dependent rules stay client-side
 * or in DatabaseService overlap/buffer checks.
 */

export type GuestFormFormatValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateGuestFormCheckOutAfterCheckIn(
  checkInDate: string,
  checkOutDate: string
): GuestFormFormatValidationResult {
  if (!checkInDate || !checkOutDate) {
    return { ok: false, message: 'Check-in and check-out dates are required' };
  }
  if (checkOutDate <= checkInDate) {
    return { ok: false, message: 'Check-out date must be after check-in date' };
  }
  return { ok: true };
}

/** Format-only fields shared by submit-form and submit-form-completion. */
export function validateGuestFormFormatFields(formData: FormData): GuestFormFormatValidationResult {
  const guestFacebookName = ((formData.get('guestFacebookName') as string) || '').trim();
  if (!guestFacebookName) {
    return { ok: false, message: 'Your name is required' };
  }

  const guestEmailRaw = ((formData.get('guestEmail') as string) || '').trim();
  if (!guestEmailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmailRaw)) {
    return { ok: false, message: 'Please enter a valid email address' };
  }

  const guestPhoneDigits = ((formData.get('guestPhoneNumber') as string) || '').replace(
    /\s+/g,
    ''
  );
  if (!/^09\d{9}$/.test(guestPhoneDigits)) {
    return {
      ok: false,
      message: "Please enter a valid 11-digit phone number starting with '09'",
    };
  }

  const numberOfAdultsRaw = formData.get('numberOfAdults');
  const numberOfAdults = numberOfAdultsRaw != null ? Number(numberOfAdultsRaw) : NaN;
  if (!Number.isFinite(numberOfAdults) || numberOfAdults < 1) {
    return { ok: false, message: 'At least 1 adult guest is required' };
  }

  return { ok: true };
}
