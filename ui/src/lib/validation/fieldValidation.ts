import { z } from 'zod';

/**
 * Shared field format validation for contact info across admin + guest flows.
 * Keep payment-specific rules in paymentProviders.ts; guest Zod schema mirrors these.
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

/** Guest-style full name (first + last, min 2 chars each). */
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

export function validatePropertyContactField(
  field: 'contactName' | 'contactPhone' | 'contactEmail',
  value: string
): string | null {
  switch (field) {
    case 'contactName':
      return validateFullPersonName(value);
    case 'contactPhone':
      return validatePhilippineMobilePhone(value);
    case 'contactEmail':
      return validateEmailAddress(value);
    default:
      return null;
  }
}

export function formatPhilippineMobileDisplay(raw: string): string {
  const digits = normalizePhoneDigits(raw);
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return raw.trim();
}

const PHILIPPINE_MOBILE_LENGTH_MESSAGE = 'Phone number must be 11 digits (ex. 09876543210)';
const PHILIPPINE_MOBILE_FORMAT_MESSAGE =
  "Please enter a valid 11-digit phone number starting with '09' (ex. 09876543210)";

/** Required 11-digit Philippine mobile (`09…`) — shared by guest + parking Zod schemas. */
export function requiredPhilippineMobilePhoneZodSchema(
  requiredMessage = 'Phone number is required'
) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .transform((val) => normalizePhoneDigits(val))
    .pipe(
      z
        .string()
        .min(11, PHILIPPINE_MOBILE_LENGTH_MESSAGE)
        .max(11, PHILIPPINE_MOBILE_LENGTH_MESSAGE)
        .refine((val) => /^09\d{9}$/.test(val), PHILIPPINE_MOBILE_FORMAT_MESSAGE)
    );
}
