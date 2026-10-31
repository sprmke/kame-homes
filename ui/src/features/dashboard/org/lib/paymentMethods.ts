/**
 * Property payment methods — mirrors `supabase/functions/_shared/paymentMethods.ts`.
 */

import {
  DEFAULT_PAYMENT_PROVIDER,
  formatPaymentAccountNumberDisplay,
  normalizePaymentProvider,
  validatePaymentAccountName,
  validatePaymentAccountNumber,
  validatePaymentProvider,
} from '@/features/dashboard/org/lib/paymentProviders';

/** Max payment methods per property — keep in sync with `_shared/paymentMethods.ts`. */
export const MAX_PROPERTY_PAYMENT_METHODS = 3;

export type PropertyPaymentMethod = {
  id: string;
  provider: string;
  accountName: string;
  accountNumber: string;
  qrImageUrl: string | null;
  isPrimary: boolean;
};

export function createEmptyPaymentMethod(isPrimary = false): PropertyPaymentMethod {
  return {
    id: crypto.randomUUID(),
    provider: DEFAULT_PAYMENT_PROVIDER,
    accountName: '',
    accountNumber: '',
    qrImageUrl: null,
    isPrimary,
  };
}

export function paymentMethodsFromLegacyFields(input: {
  paymentProvider: string;
  gcashName: string;
  gcashNumber: string;
  gcashQrImageUrl: string;
}): PropertyPaymentMethod[] {
  const provider = normalizePaymentProvider(input.paymentProvider);
  const accountName = input.gcashName.trim();
  const accountNumber = input.gcashNumber.trim();
  if (!accountName && !accountNumber) return [createEmptyPaymentMethod(true)];
  return [
    {
      id: crypto.randomUUID(),
      provider,
      accountName,
      accountNumber,
      qrImageUrl: input.gcashQrImageUrl.trim() || null,
      isPrimary: true,
    },
  ];
}

export function normalizePaymentMethodsDraft(
  raw: PropertyPaymentMethod[] | undefined,
  legacy: {
    paymentProvider: string;
    gcashName: string;
    gcashNumber: string;
    gcashQrImageUrl: string;
  }
): PropertyPaymentMethod[] {
  if (!raw?.length) return paymentMethodsFromLegacyFields(legacy);
  const parsed = raw.map((m) => ({
    id: m.id?.trim() || crypto.randomUUID(),
    provider: normalizePaymentProvider(m.provider),
    accountName: m.accountName?.trim() ?? '',
    accountNumber: m.accountNumber?.trim() ?? '',
    qrImageUrl: m.qrImageUrl?.trim() || null,
    isPrimary: m.isPrimary === true,
  }));
  const primaryIdx = parsed.findIndex((m) => m.isPrimary);
  if (primaryIdx < 0 && parsed.length > 0) {
    parsed[0] = { ...parsed[0], isPrimary: true };
  }
  return parsed.map((m, i) => ({
    ...m,
    isPrimary: primaryIdx >= 0 ? i === primaryIdx : i === 0,
  }));
}

export function primaryPaymentMethod(
  methods: PropertyPaymentMethod[]
): PropertyPaymentMethod | null {
  if (methods.length === 0) return null;
  return methods.find((m) => m.isPrimary) ?? methods[0] ?? null;
}

export function setPrimaryPaymentMethod(
  methods: PropertyPaymentMethod[],
  id: string
): PropertyPaymentMethod[] {
  return methods.map((m) => ({ ...m, isPrimary: m.id === id }));
}

/** Set QR URL on a specific payment method (draft-only until OTP-gated save). */
export function setPaymentMethodQrUrl(
  methods: PropertyPaymentMethod[],
  methodId: string,
  qrImageUrl: string | null
): PropertyPaymentMethod[] {
  const trimmed = qrImageUrl?.trim() || null;
  return methods.map((m) => (m.id === methodId ? { ...m, qrImageUrl: trimmed } : m));
}

/** @deprecated Use setPaymentMethodQrUrl */
export function setPrimaryPaymentMethodQrUrl(
  methods: PropertyPaymentMethod[],
  qrImageUrl: string | null
): PropertyPaymentMethod[] {
  const primary = primaryPaymentMethod(methods);
  if (!primary) return methods;
  return setPaymentMethodQrUrl(methods, primary.id, qrImageUrl);
}

export function validatePaymentMethods(methods: PropertyPaymentMethod[]): string | null {
  if (methods.length === 0) return 'Add at least one payment method';
  if (methods.length > MAX_PROPERTY_PAYMENT_METHODS) {
    return `You can add up to ${MAX_PROPERTY_PAYMENT_METHODS} payment methods`;
  }
  if (methods.filter((m) => m.isPrimary).length !== 1) {
    return 'Mark exactly one payment method as primary';
  }
  for (let i = 0; i < methods.length; i++) {
    const m = methods[i];
    const label = `Payment method ${i + 1}`;
    const providerErr = validatePaymentProvider(m.provider);
    if (providerErr) return `${label}: ${providerErr}`;
    if (!m.accountName.trim()) return `${label}: Enter the account name`;
    const nameErr = validatePaymentAccountName(m.accountName);
    if (nameErr) return `${label}: ${nameErr}`;
    if (!m.accountNumber.trim()) return `${label}: Enter the account number`;
    const numberErr = validatePaymentAccountNumber(m.provider, m.accountNumber);
    if (numberErr) return `${label}: ${numberErr}`;
  }
  return null;
}

/** Per-field errors for Manage modal / settings completion (QR is optional). */
export function resolvePaymentMethodFieldError(
  methods: PropertyPaymentMethod[],
  fieldId: string
): string | null {
  if (fieldId === 'payment-methods') {
    return validatePaymentMethods(methods);
  }

  const match = /^payment-method-(.+)-(provider|name|number|qr)$/.exec(fieldId);
  if (!match) return null;
  const method = methods.find((row) => row.id === match[1]);
  if (!method) return null;

  const kind = match[2];
  if (kind === 'provider') return validatePaymentProvider(method.provider);
  if (kind === 'name') {
    if (!method.accountName.trim()) return 'Enter the account name';
    return validatePaymentAccountName(method.accountName);
  }
  if (kind === 'number') {
    if (!method.accountNumber.trim()) return 'Enter the account number';
    return validatePaymentAccountNumber(method.provider, method.accountNumber);
  }
  return null;
}

export function paymentMethodEditorFieldIds(methods: PropertyPaymentMethod[]): string[] {
  const ids: string[] = ['payment-methods'];
  for (const method of methods) {
    ids.push(
      `payment-method-${method.id}-provider`,
      `payment-method-${method.id}-name`,
      `payment-method-${method.id}-number`
    );
  }
  return ids;
}

export function clonePaymentMethods(methods: PropertyPaymentMethod[]): PropertyPaymentMethod[] {
  return methods.map((method) => ({ ...method }));
}

export function syncLegacyPaymentFieldsFromMethods(methods: PropertyPaymentMethod[]): {
  paymentProvider: string;
  gcashName: string;
  gcashNumber: string;
} {
  const primary = primaryPaymentMethod(methods);
  if (!primary) {
    return { paymentProvider: DEFAULT_PAYMENT_PROVIDER, gcashName: '', gcashNumber: '' };
  }
  return {
    paymentProvider: primary.provider,
    gcashName: primary.accountName,
    gcashNumber: formatPaymentAccountNumberDisplay(primary.provider, primary.accountNumber),
  };
}

export function paymentMethodsEqual(
  a: PropertyPaymentMethod[],
  b: PropertyPaymentMethod[]
): boolean {
  if (a.length !== b.length) return false;
  const sortKey = (m: PropertyPaymentMethod) => m.id;
  const sortedA = [...a].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  const sortedB = [...b].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  return sortedA.every((m, i) => {
    const o = sortedB[i];
    return (
      m.id === o.id &&
      m.provider === o.provider &&
      m.accountName === o.accountName &&
      m.accountNumber === o.accountNumber &&
      (m.qrImageUrl ?? '') === (o.qrImageUrl ?? '') &&
      m.isPrimary === o.isPrimary
    );
  });
}

export function paymentMethodsDraftIsDirty(
  draft: PropertyPaymentMethod[],
  baseline: PropertyPaymentMethod[]
): boolean {
  return !paymentMethodsEqual(draft, baseline);
}
