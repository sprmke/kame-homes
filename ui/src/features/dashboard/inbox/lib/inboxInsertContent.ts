import type { PropertyPaymentMethod } from '@/features/dashboard/org/lib/paymentMethods';
import { formatPaymentAccountNumberDisplay } from '@/features/dashboard/org/lib/paymentProviders';

/** Guest-safe payment block for chat composer insert. */
export function formatPaymentMethodsChatText(methods: PropertyPaymentMethod[]): string | null {
  const rows = methods.filter((m) => m.accountName.trim() && m.accountNumber.trim());
  if (rows.length === 0) return null;

  const lines = rows.map((method) => {
    const provider = method.provider.trim() || 'Payment';
    const name = method.accountName.trim();
    const number = formatPaymentAccountNumberDisplay(method.provider, method.accountNumber);
    return `${provider}: ${name} (${number})`;
  });

  return ['Payment methods:', ...lines].join('\n');
}

export function readPropertyMapsUrl(settings: Record<string, unknown> | null | undefined): string {
  const raw = settings?.mapsUrl;
  return typeof raw === 'string' ? raw.trim() : '';
}
