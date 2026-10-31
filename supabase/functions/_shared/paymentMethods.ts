/**
 * Property payment methods — JSONB on app_settings.payment_methods.
 * Keep in sync with `ui/src/features/dashboard/org/lib/paymentMethods.ts`.
 */

import {
  DEFAULT_PAYMENT_PROVIDER,
  formatPaymentAccountNumberDisplay,
  normalizePaymentProvider,
  validatePaymentAccountName,
  validatePaymentAccountNumber,
  validatePaymentProvider,
} from './paymentProviders.ts';

/** Max payment methods per property — keep in sync with `ui/.../paymentMethods.ts`. */
export const MAX_PROPERTY_PAYMENT_METHODS = 3;

export type PropertyPaymentMethod = {
  id: string;
  provider: string;
  accountName: string;
  accountNumber: string;
  qrImageUrl: string | null;
  isPrimary: boolean;
};

type LegacyPaymentRow = {
  payment_provider?: string | null;
  gcash_name?: string | null;
  gcash_number?: string | null;
  gcash_qr_image_url?: string | null;
};

function newMethodId(): string {
  return crypto.randomUUID();
}

/** Drop empty / platform-seed QR paths — QR is optional per payment method. */
export function sanitizePaymentQrImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() || '';
  if (!trimmed) return null;
  if (trimmed.toLowerCase().includes('kame-home-gcash-qr-payment')) return null;
  return trimmed;
}

export function paymentMethodsFromLegacyRow(
  row: LegacyPaymentRow | null | undefined,
  defaultQrUrl: string
): PropertyPaymentMethod[] {
  const provider = normalizePaymentProvider(row?.payment_provider);
  const accountName = (row?.gcash_name ?? '').trim();
  const accountNumber = (row?.gcash_number ?? '').trim();
  const qrImageUrl =
    sanitizePaymentQrImageUrl(row?.gcash_qr_image_url) || sanitizePaymentQrImageUrl(defaultQrUrl);

  if (!accountName && !accountNumber && provider === DEFAULT_PAYMENT_PROVIDER) {
    return [];
  }

  return [
    {
      id: newMethodId(),
      provider,
      accountName,
      accountNumber,
      qrImageUrl,
      isPrimary: true,
    },
  ];
}

export function normalizePaymentMethods(
  raw: unknown,
  legacyRow: LegacyPaymentRow | null | undefined,
  defaultQrUrl: string
): PropertyPaymentMethod[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return paymentMethodsFromLegacyRow(legacyRow, defaultQrUrl);
  }

  const parsed: PropertyPaymentMethod[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newMethodId();
    const provider = normalizePaymentProvider(
      typeof row.provider === 'string' ? row.provider : DEFAULT_PAYMENT_PROVIDER
    );
    const accountName = typeof row.accountName === 'string' ? row.accountName.trim() : '';
    const accountNumber = typeof row.accountNumber === 'string' ? row.accountNumber.trim() : '';
    const qrImageUrl = sanitizePaymentQrImageUrl(
      typeof row.qrImageUrl === 'string' ? row.qrImageUrl : null
    );
    parsed.push({
      id,
      provider,
      accountName,
      accountNumber,
      qrImageUrl,
      isPrimary: row.isPrimary === true,
    });
  }

  if (parsed.length === 0) {
    return paymentMethodsFromLegacyRow(legacyRow, defaultQrUrl);
  }

  const primaryIdx = parsed.findIndex((m) => m.isPrimary);
  if (primaryIdx < 0) {
    parsed[0] = { ...parsed[0], isPrimary: true };
    for (let i = 1; i < parsed.length; i++) {
      parsed[i] = { ...parsed[i], isPrimary: false };
    }
  } else {
    for (let i = 0; i < parsed.length; i++) {
      parsed[i] = { ...parsed[i], isPrimary: i === primaryIdx };
    }
  }

  return parsed;
}

export function primaryPaymentMethod(
  methods: PropertyPaymentMethod[]
): PropertyPaymentMethod | null {
  if (methods.length === 0) return null;
  return methods.find((m) => m.isPrimary) ?? methods[0] ?? null;
}

export function validatePaymentMethods(methods: PropertyPaymentMethod[]): string | null {
  if (methods.length === 0) {
    return 'Add at least one payment method';
  }
  if (methods.length > MAX_PROPERTY_PAYMENT_METHODS) {
    return `You can add up to ${MAX_PROPERTY_PAYMENT_METHODS} payment methods`;
  }
  const primaryCount = methods.filter((m) => m.isPrimary).length;
  if (primaryCount !== 1) {
    return 'Mark exactly one payment method as primary';
  }
  for (let i = 0; i < methods.length; i++) {
    const m = methods[i];
    const label = `Payment method ${i + 1}`;
    const providerErr = validatePaymentProvider(m.provider);
    if (providerErr) return `${label}: ${providerErr}`;
    const nameErr = validatePaymentAccountName(m.accountName);
    if (nameErr) return `${label}: ${nameErr}`;
    if (!m.accountName.trim()) return `${label}: Enter account name`;
    const numberErr = validatePaymentAccountNumber(m.provider, m.accountNumber);
    if (numberErr) return `${label}: ${numberErr}`;
    if (!m.accountNumber.trim()) return `${label}: Enter account number`;
  }
  return null;
}

export function serializePaymentMethodsForDb(
  methods: PropertyPaymentMethod[]
): PropertyPaymentMethod[] {
  const err = validatePaymentMethods(methods);
  if (err) throw new Error(err);
  return methods.map((m) => ({
    id: m.id.trim() || newMethodId(),
    provider: normalizePaymentProvider(m.provider),
    accountName: m.accountName.trim(),
    accountNumber: m.accountNumber.trim(),
    qrImageUrl: sanitizePaymentQrImageUrl(m.qrImageUrl),
    isPrimary: m.isPrimary,
  }));
}

export function legacyColumnsFromPrimaryMethod(
  methods: PropertyPaymentMethod[],
  fallbackQrUrl: string
): {
  payment_provider: string;
  gcash_name: string;
  gcash_number: string;
  gcash_qr_image_url: string | null;
} {
  const primary = primaryPaymentMethod(methods);
  if (!primary) {
    return {
      payment_provider: DEFAULT_PAYMENT_PROVIDER,
      gcash_name: '',
      gcash_number: '',
      gcash_qr_image_url: null,
    };
  }
  return {
    payment_provider: primary.provider,
    gcash_name: primary.accountName,
    gcash_number: primary.accountNumber,
    gcash_qr_image_url:
      sanitizePaymentQrImageUrl(primary.qrImageUrl) || sanitizePaymentQrImageUrl(fallbackQrUrl),
  };
}

export function formatPaymentMethodsForGuest(
  methods: PropertyPaymentMethod[]
): PropertyPaymentMethod[] {
  return methods.map((m) => ({
    ...m,
    accountNumber: formatPaymentAccountNumberDisplay(m.provider, m.accountNumber),
    qrImageUrl: sanitizePaymentQrImageUrl(m.qrImageUrl),
  }));
}
