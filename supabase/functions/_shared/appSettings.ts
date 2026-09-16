/**
 * Resolved operator settings from DB (`app_settings`) per property.
 * Platform secrets (API keys, service accounts) stay in env — not here.
 */

import { createServiceClient } from './orgAuth.ts';
import { applyPropertyOrLegacySingletonFilter } from './supabaseQuery.ts';
import { trimOrEmpty } from './stringUtils.ts';
import { DEFAULT_EMAIL_LOGO_URL } from './renderEmailHtml.ts';
import {
  parseDocumentRequirements,
  resolveDocumentRequirements,
  resolveResidenceDefaultDocumentRequirements,
  type DocumentRequirement,
} from './documentRequirements.ts';

type AppSettingsRow = {
  id: number;
  updated_at: string;
  email_to: string | null;
  email_reply_to: string | null;
  parking_owner_emails: string | null;
  sd_refund_cron_email_lead_minutes: number | null;
  sd_refund_cron_max_checkout_age_days: number | null;
  default_parking_rate_guest: number | null;
  automation_toggles: Record<string, unknown> | null;
  gcash_name: string | null;
  gcash_number: string | null;
  gcash_qr_image_url: string | null;
  payment_provider: string | null;
  gaf_unit_owner: string | null;
  gaf_tower_and_unit_number: string | null;
  gaf_guests_onsite_contact_person: string | null;
  gaf_owner_contact_number: string | null;
  gaf_unit_owner_signature_url: string | null;
  brand_color: string | null;
  facebook_reviews_url: string | null;
  airbnb_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  payment_methods: unknown;
  external_reviews: unknown;
  vouchers_enabled: boolean | null;
  voucher_prizes: unknown;
  voucher_reveal_style: string | null;
  document_requirements_override: unknown;
};

const EMPTY_GAF_DEFAULT = '';

export type GafDetailsResolved = {
  gafUnitOwner: string;
  gafTowerAndUnitNumber: string;
  gafGuestsOnsiteContactPerson: string;
  gafOwnerContactNumber: string;
  gafUnitOwnerSignatureUrl: string;
};

/** Path segment after public guest app origin (no leading slash — avoids Supabase CLI false import scan). */
export const DEFAULT_GCASH_QR_RELATIVE_PATH = 'images/kame-home-gcash-qr-payment.jpg';

export type AppSettingsResolved = {
  emailTo: string;
  emailReplyTo: string;
  parkingOwnerEmails: string[];
  sdRefundCronEmailLeadMinutes: number;
  sdRefundCronMaxCheckoutAgeDays: number;
  publicGuestAppOrigin: string;
  facebookReviewsUrl: string;
  airbnbUrl: string;
  emailLogoUrl: string;
  brandColor: string;
  defaultParkingRateGuest: number;
  gcashName: string;
  gcashNumber: string;
  gcashQrImageUrl: string;
  paymentProvider: string;
  paymentMethods: PropertyPaymentMethod[];
} & GafDetailsResolved;

export type GuestPaymentInfoDto = {
  gcashName: string;
  gcashNumber: string;
  gcashQrImageUrl: string;
  paymentProvider: string;
  paymentMethods: PropertyPaymentMethod[];
  emailLogoUrl: string;
  brandColor: string;
  allowPets: boolean;
  allowParking: boolean;
  allowSurpriseDecor: boolean;
  checkInTime: string;
  checkOutTime: string;
  cleaningBufferMinutes: number;
  maxAdults: number;
  maxChildren: number;
  propertyName: string;
  propertyEyebrow: string;
  propertyCoverImageUrl: string | null;
  residenceName: string | null;
  organizationName: string;
  defaultParkingRateGuest: number;
  petFee: number;
} & GafDetailsResolved;

export type AppSettingsFieldSource = 'db' | 'default';

export type {
  IntegrationFieldSource,
  IntegrationFieldStatus,
  PlatformSecretsStatus,
  PropertyIntegrationStatus,
} from './propertyIntegrationStatus.ts';

import {
  buildPlatformSecretsStatus,
  buildPropertyIntegrationStatus,
  type PlatformSecretsStatus,
  type PropertyIntegrationStatus,
} from './propertyIntegrationStatus.ts';
import { loadOrgBrandColorByPropertyId } from './orgBrandColor.ts';
import { loadOrgSettingsRowByPropertyId, pickOrgSettingsFieldsFromRow } from './orgSettings.ts';
import { resolveOrgBrandColorFromSettings } from './orgSettingsValidation.ts';
import {
  resolvePropertyFacebookUrl,
  resolvePropertyOptionalSocialUrl,
  invalidatePropertyBrandColorCache,
} from './propertyBranding.ts';
import {
  mergePropertyAutomationToggles,
  type PropertyAutomationToggles,
} from './propertyAutomationToggles.ts';
import { getEmailAutomationDefaults } from './propertyEmailAutomationDefaults.ts';
import { DEFAULT_RESIDENCE_NAME } from './propertyResidenceDefaults.ts';
import { loadDevelopmentPmoEmailByName } from './developmentSerialize.ts';
import { resolveGuestFormSettings } from './guestFormSettings.ts';
import { getDefaultPropertyId } from './propertyScope.ts';
import { loadPropertyPricing } from './propertyPricing.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import {
  DEFAULT_PAYMENT_PROVIDER,
  formatPaymentAccountNumberDisplay,
  normalizePaymentProvider,
  validatePaymentAccountName,
  validatePaymentAccountNumber,
} from './paymentProviders.ts';
import {
  formatPaymentMethodsForGuest,
  normalizePaymentMethods,
  type PropertyPaymentMethod,
} from './paymentMethods.ts';
import {
  normalizeExternalReviewsDraft,
  type PropertyExternalReview,
} from './propertyExternalReviews.ts';
import { normalizeVoucherPrizes, type VoucherPrize } from './voucher.ts';
import { normalizeVoucherRevealStyle, type VoucherRevealStyle } from './voucherRevealStyle.ts';
import type { GuestFormData } from './types.ts';

export type AppSettingsDto = AppSettingsResolved & {
  /** Property-stored brand hex for admin forms (empty when inheriting org default). */
  brandColorStored: string;
  /** Org brand color (org settings → platform default) — property Reset target. */
  inheritedBrandColor: string;
  /** Resolved brand color (property → org → default) for live admin theme. */
  resolvedBrandColor: string;
  facebookPageUrl: string;
  airbnbUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  automationToggles: PropertyAutomationToggles;
  externalReviews: PropertyExternalReview[];
  /** When false, SD / guest-review skips the next-stay voucher step. Default true. */
  vouchersEnabled: boolean;
  /** Stored host prizes; empty = platform defaults at claim time. */
  voucherPrizes: VoucherPrize[];
  /** Guest award animation on SD form / guest-review. */
  voucherRevealStyle: VoucherRevealStyle;
  /** Raw stored override — `null` means "inherit residence default"; `[]` is a valid explicit empty override (D2). */
  documentRequirementsOverride: DocumentRequirement[] | null;
  /** Override → residence-type default → `DEFAULT_DOCUMENT_REQUIREMENTS`, fully resolved for display. */
  resolvedDocumentRequirements: DocumentRequirement[];
  /** Residence-type default → `DEFAULT_DOCUMENT_REQUIREMENTS` — ignores property override. */
  residenceDefaultDocumentRequirements: DocumentRequirement[];
  updatedAt: string | null;
  fieldSources: Record<
    | keyof AppSettingsResolved
    | 'brandColorStored'
    | 'facebookPageUrl'
    | 'airbnbUrl'
    | 'instagramUrl'
    | 'tiktokUrl',
    AppSettingsFieldSource
  >;
  propertyIntegrations: PropertyIntegrationStatus;
  platformSecrets: PlatformSecretsStatus;
};

const CACHE_TTL_MS = 30_000;
const cacheByProperty = new Map<string, { at: number; row: AppSettingsRow | null }>();

export function invalidateAppSettingsCache(propertyId?: string | null): void {
  if (propertyId) cacheByProperty.delete(propertyId);
  else cacheByProperty.clear();
  invalidatePropertyBrandColorCache(propertyId);
}

function cacheKey(propertyId?: string | null): string {
  return propertyId ?? 'legacy';
}

async function loadOrganizationSettingsByPropertyId(
  propertyId: string
): Promise<Record<string, unknown> | null> {
  const sb = createServiceClient();
  const { data: propertyRow, error: propertyError } = await sb
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (propertyError || !propertyRow?.organization_id) return null;

  const { data: organizationRow, error: organizationError } = await sb
    .from('organizations')
    .select('settings')
    .eq('id', propertyRow.organization_id)
    .maybeSingle();
  if (organizationError) return null;

  return organizationRow?.settings &&
    typeof organizationRow.settings === 'object' &&
    !Array.isArray(organizationRow.settings)
    ? (organizationRow.settings as Record<string, unknown>)
    : null;
}

async function loadSettingsRow(propertyId?: string | null): Promise<AppSettingsRow | null> {
  const key = cacheKey(propertyId);
  const now = Date.now();
  const cached = cacheByProperty.get(key);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.row;
  }

  let query = createServiceClient().from('app_settings').select('*');
  query = applyPropertyOrLegacySingletonFilter(query, propertyId);
  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn('[appSettings] load failed:', error.message);
    cacheByProperty.set(key, { at: now, row: null });
    return null;
  }

  cacheByProperty.set(key, { at: now, row: data as AppSettingsRow | null });
  return data as AppSettingsRow | null;
}

function pickDbString(dbVal: string | null | undefined): {
  value: string;
  source: AppSettingsFieldSource;
} {
  const fromDb = trimOrEmpty(dbVal);
  if (fromDb) return { value: fromDb, source: 'db' };
  return { value: '', source: 'default' };
}

/** DB-only optional URL (no env fallback). */
function pickOptionalUrl(dbVal: string | null | undefined): {
  value: string;
  source: AppSettingsFieldSource;
} {
  const fromDb = trimOrEmpty(dbVal);
  if (fromDb) return { value: fromDb, source: 'db' };
  return { value: '', source: 'default' };
}

function pickDbInt(
  dbVal: number | null | undefined,
  fallback: number,
  min: number,
  max: number
): { value: number; source: AppSettingsFieldSource } {
  if (dbVal != null && Number.isFinite(Number(dbVal))) {
    const n = Math.floor(Number(dbVal));
    if (n >= min && n <= max) {
      return { value: n, source: 'db' };
    }
  }
  return { value: fallback, source: 'default' };
}

function pickMoney(
  dbVal: number | null | undefined,
  fallback: number
): { value: number; source: AppSettingsFieldSource } {
  if (dbVal != null) {
    const n = Number(dbVal);
    if (Number.isFinite(n) && n > 0) {
      return { value: n, source: 'db' };
    }
  }
  return { value: fallback, source: 'default' };
}

function pickGafString(
  dbVal: string | null | undefined,
  fallback: string
): { value: string; source: AppSettingsFieldSource } {
  const fromDb = trimOrEmpty(dbVal);
  if (fromDb) return { value: fromDb, source: 'db' };
  return { value: fallback, source: 'default' };
}

function resolveGafDetailsFromRow(row: AppSettingsRow | null): {
  resolved: GafDetailsResolved;
  picks: Record<keyof GafDetailsResolved, { value: string; source: AppSettingsFieldSource }>;
} {
  const unitOwner = pickGafString(row?.gaf_unit_owner, EMPTY_GAF_DEFAULT);
  const tower = pickGafString(row?.gaf_tower_and_unit_number, EMPTY_GAF_DEFAULT);
  const guestsOnsite = pickGafString(row?.gaf_guests_onsite_contact_person, EMPTY_GAF_DEFAULT);
  const contact = pickGafString(row?.gaf_owner_contact_number, EMPTY_GAF_DEFAULT);
  const signatureUrl = pickOptionalUrl(row?.gaf_unit_owner_signature_url);

  return {
    resolved: {
      gafUnitOwner: unitOwner.value,
      gafTowerAndUnitNumber: tower.value,
      gafGuestsOnsiteContactPerson: guestsOnsite.value,
      gafOwnerContactNumber: contact.value,
      gafUnitOwnerSignatureUrl: signatureUrl.value,
    },
    picks: {
      gafUnitOwner: unitOwner,
      gafTowerAndUnitNumber: tower,
      gafGuestsOnsiteContactPerson: guestsOnsite,
      gafOwnerContactNumber: contact,
      gafUnitOwnerSignatureUrl: {
        value: signatureUrl.value,
        source: signatureUrl.source,
      },
    },
  };
}

function parseCommaSeparatedEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

function parseCommaSeparatedEmailsLower(raw: string): string[] {
  return parseCommaSeparatedEmails(raw).map((e) => e.toLowerCase());
}

type PropertyFieldPicks = {
  emailTo: ReturnType<typeof pickPmoEmail>;
  emailReplyTo: ReturnType<typeof pickDbString>;
  parkingRaw: ReturnType<typeof pickDbString>;
  lead: ReturnType<typeof pickDbInt>;
  maxAge: ReturnType<typeof pickDbInt>;
  parkingRate: ReturnType<typeof pickMoney>;
  gcashName: ReturnType<typeof pickDbString>;
  gcashNumber: ReturnType<typeof pickDbString>;
  gcashQr: ReturnType<typeof pickDbString>;
  paymentProvider: ReturnType<typeof pickPaymentProvider>;
  paymentMethods: PropertyPaymentMethod[];
  originBase: string;
  gaf: ReturnType<typeof resolveGafDetailsFromRow>;
};

type PropertyBrandingPicks = {
  brandColor: ReturnType<typeof pickDbString>;
  facebook: ReturnType<typeof pickDbString>;
  airbnb: ReturnType<typeof pickDbString>;
  instagram: ReturnType<typeof pickDbString>;
  tiktok: ReturnType<typeof pickDbString>;
};

function pickPropertyBrandingFromRow(row: AppSettingsRow | null): PropertyBrandingPicks {
  return {
    brandColor: pickDbString(row?.brand_color),
    facebook: pickDbString(row?.facebook_reviews_url),
    airbnb: pickDbString(row?.airbnb_url),
    instagram: pickDbString(row?.instagram_url),
    tiktok: pickDbString(row?.tiktok_url),
  };
}

function pickPmoEmail(
  developmentPmoEmail: string | null | undefined,
  legacyPropertyDbVal: string | null | undefined,
  residenceName: string
): { value: string; source: AppSettingsFieldSource } {
  const fromDevelopment = trimOrEmpty(developmentPmoEmail);
  if (fromDevelopment) return { value: fromDevelopment, source: 'db' };
  const fromDb = trimOrEmpty(legacyPropertyDbVal);
  if (fromDb) return { value: fromDb, source: 'db' };
  const fallback = getEmailAutomationDefaults(residenceName).defaultPmoEmail;
  if (fallback) return { value: fallback, source: 'default' };
  return { value: '', source: 'default' };
}

async function loadPropertyResidenceName(propertyId: string): Promise<string> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .select('residence_name')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.warn('[appSettings] residence load failed:', error.message);
    return DEFAULT_RESIDENCE_NAME;
  }

  const name = trimOrEmpty(data?.residence_name as string | null | undefined);
  return name || DEFAULT_RESIDENCE_NAME;
}

function pickPaymentProvider(row: AppSettingsRow | null): {
  value: string;
  source: AppSettingsFieldSource;
} {
  const fromDb = normalizePaymentProvider(row?.payment_provider);
  if (trimOrEmpty(row?.payment_provider)) {
    return { value: fromDb, source: 'db' };
  }
  return { value: fromDb, source: 'default' };
}

function pickPropertyFieldsFromRow(
  row: AppSettingsRow | null,
  originBase: string,
  residenceName: string,
  developmentPmoEmail: string | null
): PropertyFieldPicks {
  const emailTo = pickPmoEmail(developmentPmoEmail, row?.email_to, residenceName);
  const emailReplyTo = pickDbString(row?.email_reply_to);
  const parkingRaw = pickDbString(row?.parking_owner_emails);
  const lead = pickDbInt(row?.sd_refund_cron_email_lead_minutes, 180, 0, 10080);
  const maxAge = pickDbInt(row?.sd_refund_cron_max_checkout_age_days, 30, 0, 365);
  const parkingRate = pickMoney(row?.default_parking_rate_guest, 400);
  const paymentMethods = normalizePaymentMethods(row?.payment_methods, row, '');
  const primary = paymentMethods.find((m) => m.isPrimary) ?? paymentMethods[0];
  const gcashName = pickDbString(primary?.accountName ?? row?.gcash_name);
  const gcashNumber = pickDbString(primary?.accountNumber ?? row?.gcash_number);
  const gcashQr = pickDbString(primary?.qrImageUrl ?? row?.gcash_qr_image_url);
  const paymentProvider = {
    value: normalizePaymentProvider(primary?.provider ?? row?.payment_provider),
    source:
      trimOrEmpty(row?.payment_provider) ||
      (Array.isArray(row?.payment_methods) && row.payment_methods.length > 0)
        ? ('db' as const)
        : ('default' as const),
  };
  const gaf = resolveGafDetailsFromRow(row);

  return {
    emailTo,
    emailReplyTo,
    parkingRaw,
    lead,
    maxAge,
    parkingRate,
    gcashName,
    gcashNumber,
    gcashQr,
    paymentProvider,
    paymentMethods,
    originBase,
    gaf,
  };
}

export async function resolveAppSettings(propertyId?: string | null): Promise<AppSettingsResolved> {
  const row = await loadSettingsRow(propertyId);
  const orgRow = propertyId ? await loadOrgSettingsRowByPropertyId(propertyId) : null;
  const org = pickOrgSettingsFieldsFromRow(orgRow);
  const originBase = resolvePublicGuestAppOrigin(org.origin.value || null);
  const resolvedPropertyId = propertyId ?? (await getDefaultPropertyId());
  const residenceName = propertyId
    ? await loadPropertyResidenceName(resolvedPropertyId)
    : DEFAULT_RESIDENCE_NAME;
  const developmentPmoEmail = await loadDevelopmentPmoEmailByName(
    createServiceClient(),
    residenceName
  );
  const property = pickPropertyFieldsFromRow(row, originBase, residenceName, developmentPmoEmail);
  const branding = pickPropertyBrandingFromRow(row);
  const brandColor = await loadOrgBrandColorByPropertyId(resolvedPropertyId);

  const facebookReviewsUrl = resolvePropertyFacebookUrl(
    branding.facebook.value,
    org.facebook.value || null
  );
  const airbnbUrl = resolvePropertyOptionalSocialUrl(
    branding.airbnb.value,
    org.airbnb.value || null,
    'AIRBNB_URL'
  );

  return {
    emailTo: property.emailTo.value,
    emailReplyTo: property.emailReplyTo.value,
    parkingOwnerEmails: parseCommaSeparatedEmails(property.parkingRaw.value),
    sdRefundCronEmailLeadMinutes: property.lead.value,
    sdRefundCronMaxCheckoutAgeDays: property.maxAge.value,
    publicGuestAppOrigin: originBase,
    facebookReviewsUrl,
    airbnbUrl,
    emailLogoUrl: org.logo.value || DEFAULT_EMAIL_LOGO_URL,
    brandColor,
    defaultParkingRateGuest: property.parkingRate.value,
    gcashName: property.gcashName.value,
    gcashNumber: formatPaymentAccountNumberDisplay(
      property.paymentProvider.value,
      property.gcashNumber.value
    ),
    gcashQrImageUrl: property.gcashQr.value,
    paymentProvider: property.paymentProvider.value,
    paymentMethods: property.paymentMethods,
    ...property.gaf.resolved,
  };
}

export async function serializeGuestPaymentInfo(
  propertyId?: string | null
): Promise<GuestPaymentInfoDto> {
  const resolvedPropertyId = propertyId ?? (await getDefaultPropertyId());
  const [s, guestForm, pricing] = await Promise.all([
    resolveAppSettings(resolvedPropertyId),
    resolveGuestFormSettings(resolvedPropertyId),
    loadPropertyPricing(resolvedPropertyId),
  ]);

  return {
    gcashName: s.gcashName,
    gcashNumber: s.gcashNumber,
    gcashQrImageUrl: s.gcashQrImageUrl,
    paymentProvider: s.paymentProvider,
    paymentMethods: formatPaymentMethodsForGuest(s.paymentMethods),
    gafUnitOwner: s.gafUnitOwner,
    gafTowerAndUnitNumber: s.gafTowerAndUnitNumber,
    gafGuestsOnsiteContactPerson: s.gafGuestsOnsiteContactPerson,
    gafOwnerContactNumber: s.gafOwnerContactNumber,
    gafUnitOwnerSignatureUrl: s.gafUnitOwnerSignatureUrl,
    emailLogoUrl: s.emailLogoUrl,
    brandColor: s.brandColor,
    allowPets: guestForm.allowPets,
    allowParking: guestForm.allowParking,
    allowSurpriseDecor: guestForm.allowSurpriseDecor,
    checkInTime: guestForm.checkInTime,
    checkOutTime: guestForm.checkOutTime,
    cleaningBufferMinutes: guestForm.cleaningBufferMinutes,
    maxAdults: guestForm.maxAdults,
    maxChildren: guestForm.maxChildren,
    propertyName: guestForm.propertyName,
    propertyEyebrow: guestForm.propertyEyebrow,
    propertyCoverImageUrl: guestForm.propertyCoverImageUrl,
    residenceName: guestForm.residenceName,
    organizationName: guestForm.organizationName,
    defaultParkingRateGuest: s.defaultParkingRateGuest,
    petFee: pricing.petFee,
  };
}

/** Documents Approver / development PMO (`emailTo`) — Azure reply sender allow-list for inbound approvals. */
export async function getApprovalSenderAllowList(propertyId?: string | null): Promise<string[]> {
  const s = await resolveAppSettings(propertyId);
  return parseCommaSeparatedEmailsLower(s.emailTo);
}

export async function serializeAppSettingsForAdmin(
  propertyId?: string | null
): Promise<AppSettingsDto> {
  const row = await loadSettingsRow(propertyId);
  const orgRow = propertyId ? await loadOrgSettingsRowByPropertyId(propertyId) : null;
  const resolved = await resolveAppSettings(propertyId);
  const org = pickOrgSettingsFieldsFromRow(orgRow);
  const originBase = resolvePublicGuestAppOrigin(org.origin.value || null);
  const resolvedPropertyId = propertyId ?? (await getDefaultPropertyId());
  const residenceName = propertyId
    ? await loadPropertyResidenceName(resolvedPropertyId)
    : DEFAULT_RESIDENCE_NAME;
  const developmentPmoEmail = await loadDevelopmentPmoEmailByName(
    createServiceClient(),
    residenceName
  );
  const property = pickPropertyFieldsFromRow(row, originBase, residenceName, developmentPmoEmail);
  const branding = pickPropertyBrandingFromRow(row);

  const orgSettingsRaw = resolvedPropertyId
    ? await loadOrganizationSettingsByPropertyId(resolvedPropertyId)
    : null;
  const inheritedBrandColor = resolveOrgBrandColorFromSettings(orgSettingsRaw);

  return {
    ...resolved,
    brandColorStored: branding.brandColor.value,
    inheritedBrandColor,
    resolvedBrandColor: resolved.brandColor,
    facebookPageUrl: branding.facebook.value,
    airbnbUrl: branding.airbnb.value,
    instagramUrl: branding.instagram.value,
    tiktokUrl: branding.tiktok.value,
    automationToggles: mergePropertyAutomationToggles(row?.automation_toggles),
    externalReviews: normalizeExternalReviewsDraft(row?.external_reviews),
    vouchersEnabled: row?.vouchers_enabled !== false,
    voucherPrizes: normalizeVoucherPrizes(row?.voucher_prizes),
    voucherRevealStyle: normalizeVoucherRevealStyle(row?.voucher_reveal_style),
    documentRequirementsOverride: Array.isArray(row?.document_requirements_override)
      ? parseDocumentRequirements(row.document_requirements_override)
      : null,
    resolvedDocumentRequirements: await resolveDocumentRequirements(resolvedPropertyId).catch(
      (e) => {
        console.warn('[appSettings] resolveDocumentRequirements failed:', e);
        return [];
      }
    ),
    residenceDefaultDocumentRequirements: await resolveResidenceDefaultDocumentRequirements(
      resolvedPropertyId
    ).catch((e) => {
      console.warn('[appSettings] resolveResidenceDefaultDocumentRequirements failed:', e);
      return [];
    }),
    updatedAt: row?.updated_at ?? null,
    fieldSources: {
      emailTo: property.emailTo.source,
      emailReplyTo: property.emailReplyTo.source,
      parkingOwnerEmails: property.parkingRaw.source,
      sdRefundCronEmailLeadMinutes: property.lead.source,
      sdRefundCronMaxCheckoutAgeDays: property.maxAge.source,
      publicGuestAppOrigin: 'default' as const,
      facebookReviewsUrl: branding.facebook.source,
      emailLogoUrl: org.logo.source,
      brandColor: branding.brandColor.source,
      brandColorStored: branding.brandColor.source,
      facebookPageUrl: branding.facebook.source,
      airbnbUrl: branding.airbnb.source,
      instagramUrl: branding.instagram.source,
      tiktokUrl: branding.tiktok.source,
      defaultParkingRateGuest: property.parkingRate.source,
      gcashName: property.gcashName.source,
      gcashNumber: property.gcashNumber.source,
      gcashQrImageUrl: property.gcashQr.source,
      paymentProvider: property.paymentProvider.source,
      paymentMethods:
        trimOrEmpty(row?.payment_provider) ||
        (Array.isArray(row?.payment_methods) && row.payment_methods.length > 0)
          ? ('db' as const)
          : ('default' as const),
      gafUnitOwner: property.gaf.picks.gafUnitOwner.source,
      gafTowerAndUnitNumber: property.gaf.picks.gafTowerAndUnitNumber.source,
      gafGuestsOnsiteContactPerson: property.gaf.picks.gafGuestsOnsiteContactPerson.source,
      gafOwnerContactNumber: property.gaf.picks.gafOwnerContactNumber.source,
      gafUnitOwnerSignatureUrl: property.gaf.picks.gafUnitOwnerSignatureUrl.source,
    },
    propertyIntegrations: await buildPropertyIntegrationStatus(propertyId!),
    platformSecrets: buildPlatformSecretsStatus(),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailList(raw: string, label: string): string | null {
  const parts = parseCommaSeparatedEmails(raw);
  if (parts.length === 0) return null;
  for (const e of parts) {
    if (!EMAIL_RE.test(e)) return `Invalid ${label} address: ${e}`;
  }
  return null;
}

export function validateOptionalEmail(raw: string, label: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (!EMAIL_RE.test(v)) return `Invalid ${label}`;
  return null;
}

export function validateOptionalUrl(raw: string, label: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return `${label} must use http or https`;
    }
  } catch {
    return `Invalid ${label} URL`;
  }
  return null;
}

export function validateRequiredUrl(
  raw: string,
  label: string,
  emptyMessage: string
): string | null {
  const v = raw.trim();
  if (!v) return emptyMessage;
  return validateOptionalUrl(raw, label);
}

export function validateOptionalOrigin(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return 'Guest app origin must use http or https';
    }
    if (u.pathname !== '/' || u.search || u.hash) {
      return 'Guest app origin should be scheme + host only (no path)';
    }
  } catch {
    return 'Invalid guest app origin URL';
  }
  return null;
}

export async function loadAppSettingsRow(
  propertyId?: string | null
): Promise<AppSettingsRow | null> {
  return loadSettingsRow(propertyId);
}

export {
  formatPaymentAccountNumberDisplay as formatGcashNumberDisplay,
  validatePaymentAccountName as validateGcashName,
} from './paymentProviders.ts';

export function validateGcashNumber(raw: string): string | null {
  return validatePaymentAccountNumber(DEFAULT_PAYMENT_PROVIDER, raw);
}

export function validateGafTextField(raw: string, label: string, maxLen = 120): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.length > maxLen) return `${label} is too long (max ${maxLen} characters)`;
  return null;
}

export function validateGafContactNumber(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.length > 40) return 'Owner contact number is too long (max 40 characters)';
  const digits = v.replace(/\D/g, '');
  if (digits.length > 0 && digits.length < 7) {
    return 'Owner contact number looks too short';
  }
  return null;
}

/** Apply operator GAF defaults — server always wins over client-submitted values. */
export async function applyGafDefaultsToFormData<T extends Partial<GuestFormData>>(
  data: T,
  propertyId?: string | null
): Promise<T & Pick<GuestFormData, 'unitOwner' | 'towerAndUnitNumber' | 'ownerOnsiteContactPerson' | 'ownerContactNumber'>> {
  const s = await resolveAppSettings(propertyId);
  return {
    ...data,
    unitOwner: s.gafUnitOwner,
    towerAndUnitNumber: s.gafTowerAndUnitNumber,
    ownerOnsiteContactPerson: s.gafGuestsOnsiteContactPerson,
    ownerContactNumber: s.gafOwnerContactNumber,
  };
}
