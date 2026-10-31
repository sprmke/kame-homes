/**
 * Payment settings fingerprint — mirrors `supabase/functions/_shared/settingsVerification.ts`.
 */

import type { PropertyPaymentMethod } from '@/features/dashboard/org/lib/paymentMethods';
import {
  formatPaymentAccountNumberDisplay,
  normalizePaymentProvider,
} from '@/features/dashboard/org/lib/paymentProviders';

function canonicalizePaymentMethodsForFingerprint(methods: PropertyPaymentMethod[]): Array<{
  id: string;
  provider: string;
  accountName: string;
  accountNumber: string;
  qrImageUrl: string | null;
  isPrimary: boolean;
}> {
  return methods
    .map((m) => ({
      id: String(m.id ?? '').trim(),
      provider: normalizePaymentProvider(m.provider),
      accountName: String(m.accountName ?? '').trim(),
      accountNumber: formatPaymentAccountNumberDisplay(
        normalizePaymentProvider(m.provider),
        String(m.accountNumber ?? '').trim()
      ),
      qrImageUrl: m.qrImageUrl?.trim() || null,
      isPrimary: m.isPrimary === true,
    }))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
}

export async function computePaymentSettingsFingerprint(
  methods: PropertyPaymentMethod[]
): Promise<string> {
  const canonical = canonicalizePaymentMethodsForFingerprint(methods);
  const json = JSON.stringify({ paymentMethods: canonical });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
