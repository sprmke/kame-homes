import type { GuestPaymentInfo } from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { DEFAULT_GUEST_PAYMENT_INFO } from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { DEFAULT_ORG_LOGO_URL } from '@/features/guest/marketing/properties/lib/mapPublicPropertyDetail';

import { PLATFORM_APP_NAME, resolveOrgDisplayName } from '@/lib/platformBranding';

export {
  isLegacyPlatformOrgBrand as isLegacyKameHomeBrand,
  resolveOrgDisplayName,
} from '@/lib/platformBranding';

/** @deprecated Prefer `resolveOrgDisplayName` / `PLATFORM_APP_NAME`. */
export const PLATFORM_BRAND_NAME = PLATFORM_APP_NAME || 'Host';

export function formatResidenceShortName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+Residences$/i, '').trim() || trimmed;
}

export function resolveGuestFormLogoUrl(
  info: Pick<GuestPaymentInfo, 'emailLogoUrl' | 'propertyCoverImageUrl'>
): string {
  const logo = info.emailLogoUrl?.trim();
  if (logo) return logo;
  const cover = info.propertyCoverImageUrl?.trim();
  if (cover) return cover;
  return DEFAULT_ORG_LOGO_URL;
}

export function formatPaidParkingDescription(residenceName: string | null): string {
  const place = formatResidenceShortName(residenceName) || 'the building';
  return `We'll help you reserve and pay for a spot inside ${place} separately, after this booking is confirmed.`;
}

export function formatNoPaidParkingDescription(_residenceName: string | null): string {
  return 'No slot: building drop-off only. Free parking may be available nearby.';
}

export function formatPetPolicyTitle(residenceName: string | null): string {
  const place = formatResidenceShortName(residenceName) || 'Building';
  return `🐶 ${place} Pet Policy`;
}

export function formatPetFeeLine(petFee: number): string {
  return `Pet fee: ₱${petFee.toLocaleString('en-PH')}`;
}

export function formatGafEmailHint(residenceName: string | null): string {
  const place = formatResidenceShortName(residenceName) || 'property';
  return `Use an email you can access. Your GAF will be sent there for ${place} check-in.`;
}

function resolveGuestFooterOrgName(organizationName: string | null | undefined): string {
  return resolveOrgDisplayName(organizationName, 'Host');
}

/** Copyright line for operational guest pages — host org, or platform brand. No residence. */
export function formatGuestFooterLabel(
  organizationName: string | null | undefined,
  _residenceName?: string | null | undefined
): string {
  const year = new Date().getFullYear();
  return `© ${year} ${resolveGuestFooterOrgName(organizationName)}. All rights reserved.`;
}

export function formatParkingStepHint(residenceName: string | null): string {
  const place = formatResidenceShortName(residenceName) || 'the building';
  return `Optional paid parking inside ${place}, reserved separately`;
}

export function formatGuestSuccessAdministration(residenceName: string | null): string {
  const place = formatResidenceShortName(residenceName) || 'property';
  return `property administration (${place})`;
}

export function formatPayParkingLastMinuteWarning(residenceName: string | null): string {
  const place = formatResidenceShortName(residenceName) || 'the building';
  return `Last-minute parking may take longer. Paid slots inside ${place} are limited.`;
}

export function formatGuestContactHelp(isAirbnb: boolean, isFacebook: boolean): string {
  if (isAirbnb) return 'Contact your host on Airbnb for help.';
  if (isFacebook) return 'Contact your host on Facebook for help.';
  return 'Contact your host for help.';
}

export function formatGuestMessengerReturn(isAirbnb: boolean, isFacebook: boolean): string {
  if (isAirbnb) return 'Kindly return to our conversation on Airbnb';
  if (isFacebook) return 'Kindly return to our conversation on Facebook Messenger';
  return 'Kindly return to your conversation with your host';
}

export function formatGuestCopyPasteHint(isAirbnb: boolean, isFacebook: boolean): string {
  if (isAirbnb) return 'Copy your form below and share with your host so we can help. Sorry!';
  if (isFacebook) {
    return 'Copy your form below and paste on Facebook Messenger so we can help. Sorry!';
  }
  return 'Copy your form below and share with your host so we can help. Sorry!';
}

export function formatGuestLockedChangeHint(isAirbnb: boolean, isFacebook: boolean): string {
  if (isAirbnb) return 'Contact your host on Airbnb to request changes.';
  if (isFacebook) return 'Contact your host on Facebook to request changes.';
  return 'Contact your host to request changes.';
}

export function formatGuestStayThanks(organizationName: string | null | undefined): string {
  const org = organizationName?.trim() || 'us';
  return `Thanks for staying with ${org}! We hope you had a comfortable stay with great memories.`;
}

export function formatGuestFarewell(organizationName: string | null | undefined): string {
  const org = organizationName?.trim() || 'us';
  return `We hope to host you again soon. Thank you for staying with ${org}!`;
}

export type GuestBrandHeaderProps = {
  logoSrc: string;
  logoAlt: string;
  eyebrow: string | null;
};

export function pickGuestBrandHeaderProps(
  info?: GuestPaymentInfo,
  fallbackLogoUrl?: string | null
): GuestBrandHeaderProps {
  const resolvedInfo = info ?? DEFAULT_GUEST_PAYMENT_INFO;
  const resolvedLogo = resolveGuestFormLogoUrl(resolvedInfo);
  const logoSrc =
    resolvedLogo !== DEFAULT_ORG_LOGO_URL ? resolvedLogo : fallbackLogoUrl?.trim() || resolvedLogo;

  return {
    logoSrc,
    logoAlt:
      resolvedInfo.organizationName?.trim() || resolvedInfo.propertyName?.trim() || 'Property',
    eyebrow: resolvedInfo.propertyEyebrow?.trim() || null,
  };
}

export type GuestOperationalHeaderProps = {
  propertyImageSrc: string | null;
  propertyName: string;
};

/** Operational shell header — property photo + name (not org logo). */
export function pickGuestOperationalHeaderProps(
  info?: GuestPaymentInfo
): GuestOperationalHeaderProps {
  const resolved = info ?? DEFAULT_GUEST_PAYMENT_INFO;
  const propertyName =
    resolved.propertyName?.trim() ||
    resolved.propertyEyebrow?.trim()?.split(' · ')[0]?.trim() ||
    'Property';

  return {
    propertyImageSrc: resolved.propertyCoverImageUrl?.trim() || null,
    propertyName,
  };
}
