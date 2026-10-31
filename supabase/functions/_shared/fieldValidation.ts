/**
 * Shared field format validation — keep in sync with ui/src/lib/validation/fieldValidation.ts.
 */

export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\s+/g, '');
}

export function validateEmailAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 254) return 'Email is too long';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Please enter a valid email address';
  }
  return null;
}

export function validatePhilippineMobilePhone(raw: string): string | null {
  const digits = normalizePhoneDigits(raw);
  if (!digits) return null;
  if (digits.length !== 11) {
    return 'Phone number must be 11 digits (ex. 09876543210)';
  }
  if (!/^09\d{9}$/.test(digits)) {
    return "Please enter a valid 11-digit phone number starting with '09'";
  }
  return null;
}

/** @deprecated Use validateFullPersonName for property contact name. */
export function validateContactPersonName(raw: string): string | null {
  return validateFullPersonName(raw);
}

export function validateFullPersonName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const words = trimmed.split(/\s+/);
  if (words.length < 2) {
    return 'Please enter the complete name';
  }
  if (words[0]!.length < 2 || words[words.length - 1]!.length < 2) {
    return 'Please enter a valid full name.';
  }
  if (trimmed.length > 120) return 'Name is too long (max 120 characters)';
  return null;
}

export function formatPhilippineMobileDisplay(raw: string): string {
  const digits = normalizePhoneDigits(raw);
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return raw.trim();
}
