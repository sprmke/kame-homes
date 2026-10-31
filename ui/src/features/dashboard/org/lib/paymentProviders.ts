/**
 * Philippine payment providers for guest downpayment / balance settlement.
 * Keep in sync with `supabase/functions/_shared/paymentProviders.ts`.
 */

import { validateFullPersonName } from '@/lib/validation/fieldValidation';

export type PaymentProviderGroup = 'ewallet' | 'digital_bank' | 'bank';

export type PaymentProviderOption = {
  value: string;
  label: string;
  group: PaymentProviderGroup;
};

export const PAYMENT_PROVIDER_GROUP_ORDER: PaymentProviderGroup[] = [
  'ewallet',
  'digital_bank',
  'bank',
];

export const PAYMENT_PROVIDER_GROUP_LABELS: Record<PaymentProviderGroup, string> = {
  ewallet: 'E-wallets',
  digital_bank: 'Digital banks',
  bank: 'Traditional banks',
};

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

export function normalizePaymentProvider(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return DEFAULT_PAYMENT_PROVIDER;
  if (PH_PAYMENT_PROVIDERS.some((entry) => entry.value === trimmed)) {
    return trimmed;
  }
  if (trimmed.toLowerCase() === 'gcash') return DEFAULT_PAYMENT_PROVIDER;
  return trimmed;
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

function sortProvidersInGroup(
  group: PaymentProviderGroup,
  items: PaymentProviderOption[]
): PaymentProviderOption[] {
  if (group === 'ewallet') {
    const gcash = items.find((entry) => entry.value === 'GCash');
    const rest = items
      .filter((entry) => entry.value !== 'GCash')
      .sort((a, b) => a.label.localeCompare(b.label));
    return gcash ? [gcash, ...rest] : rest;
  }

  return items.slice().sort((a, b) => a.label.localeCompare(b.label));
}

export function providersByGroup(group: PaymentProviderGroup): PaymentProviderOption[] {
  return sortProvidersInGroup(
    group,
    PH_PAYMENT_PROVIDERS.filter((entry) => entry.group === group)
  );
}

export function paymentProviderLabel(value: string): string {
  const match = PH_PAYMENT_PROVIDERS.find((entry) => entry.value === value);
  return match?.label ?? normalizePaymentProvider(value);
}

export function paymentProviderGroup(value: string): PaymentProviderGroup | null {
  const match = PH_PAYMENT_PROVIDERS.find((entry) => entry.value === value);
  return match?.group ?? null;
}

export function isAllowedPaymentProvider(raw: string): boolean {
  return PH_PAYMENT_PROVIDERS.some((entry) => entry.value === raw.trim());
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
