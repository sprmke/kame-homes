/**
 * Philippine payment providers for guest downpayment / balance settlement.
 * Keep in sync with `ui/src/features/dashboard/org/lib/paymentProviders.ts`.
 */

import { validateFullPersonName } from './fieldValidation.ts';

export type PaymentProviderGroup = 'ewallet' | 'digital_bank' | 'bank';

export type PaymentProviderOption = {
  value: string;
  label: string;
  group: PaymentProviderGroup;
};

export const PAYMENT_PROVIDER_GROUP_LABELS: Record<PaymentProviderGroup, string> = {
  ewallet: 'E-wallets',
  digital_bank: 'Digital banks',
  bank: 'Traditional banks',
};

/** Curated list of PH e-wallets, digital banks, and major online banks. */
export const PH_PAYMENT_PROVIDERS: readonly PaymentProviderOption[] = [
  { value: 'GCash', label: 'GCash', group: 'ewallet' },
  { value: 'Maya', label: 'Maya', group: 'ewallet' },
  { value: 'GrabPay', label: 'GrabPay', group: 'ewallet' },
  { value: 'ShopeePay', label: 'ShopeePay', group: 'ewallet' },
  { value: 'Coins.ph', label: 'Coins.ph', group: 'ewallet' },

  { value: 'MariBank', label: 'MariBank', group: 'digital_bank' },
  { value: 'GoTyme Bank', label: 'GoTyme Bank', group: 'digital_bank' },
  { value: 'UnionDigital Bank', label: 'UnionDigital Bank', group: 'digital_bank' },
  { value: 'Tonik Bank', label: 'Tonik Bank', group: 'digital_bank' },
  { value: 'UNO Digital Bank', label: 'UNO Digital Bank', group: 'digital_bank' },
  {
    value: 'CIMB Bank Philippines',
    label: 'CIMB Bank Philippines',
    group: 'digital_bank',
  },

  { value: 'BDO', label: 'BDO', group: 'bank' },
  { value: 'BPI', label: 'BPI', group: 'bank' },
  { value: 'Metrobank', label: 'Metrobank', group: 'bank' },
  { value: 'UnionBank', label: 'UnionBank', group: 'bank' },
  {
    value: 'Land Bank',
    label: 'Land Bank of the Philippines',
    group: 'bank',
  },
  { value: 'Security Bank', label: 'Security Bank', group: 'bank' },
  { value: 'RCBC', label: 'RCBC', group: 'bank' },
  { value: 'Chinabank', label: 'Chinabank', group: 'bank' },
  { value: 'PNB', label: 'PNB', group: 'bank' },
  { value: 'EastWest Bank', label: 'EastWest Bank', group: 'bank' },
  { value: 'PSBank', label: 'PSBank', group: 'bank' },
  { value: 'Robinsons Bank', label: 'Robinsons Bank', group: 'bank' },
  { value: 'Asia United Bank', label: 'Asia United Bank', group: 'bank' },
  { value: 'Bank of Commerce', label: 'Bank of Commerce', group: 'bank' },
];

export const DEFAULT_PAYMENT_PROVIDER = 'GCash';

const MOBILE_WALLET_PROVIDERS = new Set(['GCash', 'Maya', 'GrabPay', 'ShopeePay', 'Coins.ph']);

const ALLOWED_PROVIDER_VALUES = new Set(PH_PAYMENT_PROVIDERS.map((entry) => entry.value));

export function normalizePaymentProvider(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return DEFAULT_PAYMENT_PROVIDER;
  if (ALLOWED_PROVIDER_VALUES.has(trimmed)) return trimmed;
  if (trimmed.toLowerCase() === 'gcash') return DEFAULT_PAYMENT_PROVIDER;
  return trimmed;
}

export function isAllowedPaymentProvider(raw: string): boolean {
  return ALLOWED_PROVIDER_VALUES.has(raw.trim());
}

export function isMobileWalletProvider(provider: string): boolean {
  return MOBILE_WALLET_PROVIDERS.has(normalizePaymentProvider(provider));
}

export function formatPaymentAccountNumberDisplay(provider: string, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!isMobileWalletProvider(provider)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return trimmed;
}

export function validatePaymentProvider(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Select a bank or e-wallet';
  if (!isAllowedPaymentProvider(trimmed)) {
    return 'Select a supported bank or e-wallet';
  }
  return null;
}

export function validatePaymentAccountName(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 120) {
    return 'Account name is too long (max 120 characters)';
  }
  return validateFullPersonName(value);
}

export function validatePaymentAccountNumber(provider: string, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (isMobileWalletProvider(provider)) {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      return 'Account number must be 10–11 digits';
    }
    if (!digits.startsWith('09') && !(digits.length === 10 && digits.startsWith('9'))) {
      return 'Account number should start with 09';
    }
    return null;
  }

  const normalized = value.replace(/[\s-]/g, '');
  if (normalized.length < 8 || normalized.length > 24) {
    return 'Account number must be 8–24 characters';
  }
  if (!/^[0-9A-Za-z]+$/.test(normalized)) {
    return 'Account number may only contain letters and numbers';
  }
  return null;
}

/** @deprecated Use validatePaymentAccountName */
export function validateGcashName(raw: string): string | null {
  return validatePaymentAccountName(raw);
}

/** @deprecated Use validatePaymentAccountNumber with provider */
export function validateGcashNumber(raw: string): string | null {
  return validatePaymentAccountNumber(DEFAULT_PAYMENT_PROVIDER, raw);
}

/** @deprecated Use formatPaymentAccountNumberDisplay */
export function formatGcashNumberDisplay(raw: string): string {
  return formatPaymentAccountNumberDisplay(DEFAULT_PAYMENT_PROVIDER, raw);
}

export function paymentAccountNumberLabel(_provider?: string): string {
  return 'Account Number';
}

export function paymentAccountNumberPlaceholder(_provider?: string): string {
  return 'Account number';
}

export function paymentQrAltText(provider: string): string {
  const label = normalizePaymentProvider(provider);
  return `${label} QR code for payments`;
}

export function paymentSectionTitle(provider: string): string {
  return `Pay via ${normalizePaymentProvider(provider)}`;
}

export function paymentEmailCopy(provider: string, hasQr = true): string {
  const label = normalizePaymentProvider(provider);
  if (hasQr) {
    return `Save and scan the QR code or send to the ${label} account beside it to pay your total balance upon check-in.`;
  }
  return `Send payment to the ${label} account below to pay your total balance upon check-in.`;
}
