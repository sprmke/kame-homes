import type { AppSettingsFieldSource } from '@/features/dashboard/bookings/hooks/useAppSettings';
import type { OrgSettingsFieldSource } from '@/features/dashboard/org/hooks/useOrgSettings';

/** Platform seed assets — must not appear as uploader previews. */
const PLATFORM_MEDIA_URL_MARKERS = [
  'kame-home-gcash-qr-payment',
  'kamehomes.space/images/logo',
  '/images/logo.png',
] as const;

export function isPlatformSeedMediaUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return PLATFORM_MEDIA_URL_MARKERS.some((marker) => lower.includes(marker));
}

export function storedAppSettingsMediaUrl(
  url: string | null | undefined,
  source: AppSettingsFieldSource | undefined
): string | null {
  const trimmed = url?.trim();
  if (!trimmed || source !== 'db' || isPlatformSeedMediaUrl(trimmed)) return null;
  return trimmed;
}

export function storedOrgSettingsMediaUrl(
  url: string | null | undefined,
  source: OrgSettingsFieldSource | undefined
): string | null {
  const trimmed = url?.trim();
  if (!trimmed || source !== 'db' || isPlatformSeedMediaUrl(trimmed)) return null;
  return trimmed;
}

export function resolvePaymentMethodQrDisplayUrl(input: {
  methodQrUrl: string | null | undefined;
  /** Only used when method has no QR — legacy primary column (primary methods only). */
  legacyQrUrl?: string | null | undefined;
  legacyQrSource?: AppSettingsFieldSource | undefined;
  useLegacyFallback?: boolean;
}): string | null {
  const methodQr = input.methodQrUrl?.trim();
  if (methodQr && !isPlatformSeedMediaUrl(methodQr)) return methodQr;
  if (input.useLegacyFallback) {
    return storedAppSettingsMediaUrl(input.legacyQrUrl, input.legacyQrSource);
  }
  return null;
}

/** @deprecated Use resolvePaymentMethodQrDisplayUrl */
export function resolvePrimaryPaymentQrDisplayUrl(input: {
  methodQrUrl: string | null | undefined;
  legacyQrUrl: string | null | undefined;
  legacyQrSource: AppSettingsFieldSource | undefined;
}): string | null {
  return resolvePaymentMethodQrDisplayUrl({
    ...input,
    useLegacyFallback: true,
  });
}

export function legacyGcashQrForPaymentMethods(
  gcashQrImageUrl: string,
  source: AppSettingsFieldSource | undefined
): string {
  return source === 'db' ? gcashQrImageUrl.trim() : '';
}
