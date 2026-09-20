/**
 * Render workflow emails using configurable body copy from property_template_contents.
 */

import type { AppSettingsResolved } from './appSettings.ts';
import { resolveAppSettings } from './appSettings.ts';
import {
  loadPropertyEmailBranding,
  resolveEmailUnitLabel,
  type PropertyEmailBranding,
} from './propertyEmailBranding.ts';
import { guestFormPath, guestGuestReviewPath, guestSdFormPath } from './publicGuestPaths.ts';
import {
  escapeHtml,
  loadEmailTemplate,
  replacePlaceholders,
  withEmailShellStyleVars,
} from './renderEmailHtml.ts';
import { buildDateLineBlockHtml } from './propertyTemplateEmailSections.ts';
import { normalizeBlockLevelPlaceholdersInHtml } from './normalizeBlockLevelPlaceholders.ts';
import { normalizeEmailCalloutPlaceholders } from './normalizeEmailCalloutPlaceholders.ts';
import {
  getBuiltinPropertyTemplate,
  resolvePropertyTemplateContent,
  type PropertyTemplateKey,
} from './propertyTemplates.ts';
import { computeTotalGuestBalanceFromBooking } from './totalGuestBalance.ts';
import type { GuestFormData, GuestSubmission } from './types.ts';
import { countStayNights, formatDateForEmail, formatTimeForDisplay } from './utils.ts';

/** Email template keys editable on the Templates page. */
export const PROPERTY_EMAIL_TEMPLATE_KEYS = [
  'email-gaf-request',
  'email-pet-request',
  'email-parking-request',
  'email-new-booking-request',
  'email-booking-acknowledgement',
  'email-ready-for-checkin',
  'email-sd-refund-form-request',
] as const;

export type PropertyEmailTemplateKey = (typeof PROPERTY_EMAIL_TEMPLATE_KEYS)[number];

function formatPeso(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function emailHeaderLogoHtml(propertyId?: string | null, logoAlt?: string): Promise<string> {
  const settings = await resolveAppSettings(propertyId);
  const frag = await loadEmailTemplate('fragments/email-header-logo');
  return replacePlaceholders(
    frag,
    withEmailShellStyleVars(
      {
        logoUrl: escapeHtml(settings.emailLogoUrl),
        logoAlt: escapeHtml(logoAlt ?? 'Property'),
      },
      settings.brandColor
    )
  );
}

/** Replace `{{token}}` in admin-authored HTML. Values must already be escaped when needed. */
export function normalizePropertyTemplatePlaceholderKey(raw: string): string {
  return raw.trim().replace(/-/g, '_');
}

/** Replace `{{token}}` in admin-authored HTML. Values must already be escaped when needed. */
export function applyPropertyTemplatePlaceholders(
  html: string,
  vars: Record<string, string>
): string {
  return html.replace(/\{\{([\w-]+)\}\}/g, (_, rawKey: string) => {
    const key = normalizePropertyTemplatePlaceholderKey(rawKey);
    return vars[key] ?? '';
  });
}

/** Improve WYSIWYG HTML for email clients and public stay guide (images, links). */
export function prepareConfigurableEmailBodyHtml(html: string, publicOrigin: string): string {
  let out = html;
  const base = publicOrigin.replace(/\/+$/, '');

  out = out.replace(/<img\b([^>]*?)>/gi, (match, attrs: string) => {
    let nextAttrs = attrs;
    const srcMatch = nextAttrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (srcMatch) {
      const rawSrc = (srcMatch[2] ?? srcMatch[3] ?? '').trim();
      if (rawSrc && !/^https?:\/\//i.test(rawSrc) && !rawSrc.startsWith('data:') && base) {
        const absolute = rawSrc.startsWith('/') ? `${base}${rawSrc}` : `${base}/${rawSrc}`;
        nextAttrs = nextAttrs.replace(srcMatch[0], `src="${absolute}"`);
      }
    }

    if (/style\s*=/i.test(nextAttrs)) {
      if (!/max-width\s*:/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/style\s*=\s*("([^"]*)"|'([^']*)')/i, (_m, _q, d1, d2) => {
          const existing = d1 ?? d2 ?? '';
          return `style="${existing};display:block;max-width:100%;height:auto;border-radius:8px;margin:16px 0;"`;
        });
      }
      return `<img${nextAttrs}>`;
    }
    return `<img${nextAttrs} style="display:block;max-width:100%;height:auto;border-radius:8px;margin:16px 0;">`;
  });

  if (base) {
    out = out.replace(/href\s*=\s*"(\/[^"]*)"/gi, `href="${base}$1"`);
    out = out.replace(/href\s*=\s*'(\/[^']*)'/gi, `href='${base}$1'`);
  }

  return out;
}

function decorFlags(booking: {
  guest_requests_surprise_decor?: boolean | null;
  has_pets?: boolean | null;
}) {
  const hasDecor = Boolean(booking.guest_requests_surprise_decor);
  const hasPets = Boolean(booking.has_pets);
  return {
    decor_status: hasDecor ? '🎉 Yes' : 'No',
    pet_status: hasPets ? '🐶 Yes' : 'No',
    has_decor: hasDecor ? 'Yes' : 'No',
    has_pets: hasPets ? 'Yes' : 'No',
    decor_flag: hasDecor ? '🎉 Has decor' : '',
    pet_flag: hasPets ? '🐶 Has pets' : '',
  };
}

export function buildBookingPlaceholderVars(
  booking: GuestSubmission,
  settings: AppSettingsResolved,
  extras: Record<string, string> = {},
  branding?: PropertyEmailBranding
): Record<string, string> {
  const displayCheckIn = formatDateForEmail(booking.check_in_date);
  const displayCheckOut = formatDateForEmail(booking.check_out_date);
  const pax = (booking.number_of_adults || 0) + (booking.number_of_children || 0);
  const nights = countStayNights(booking.check_in_date, booking.check_out_date);
  const unitLabel = branding
    ? resolveEmailUnitLabel(booking.tower_and_unit_number, branding)
    : String(booking.tower_and_unit_number ?? '').trim() ||
      settings.gafTowerAndUnitNumber?.trim() ||
      'Property';
  const propertyName = branding?.propertyName ?? 'Property';
  const appOrigin = settings.publicGuestAppOrigin.replace(/\/+$/, '');
  const bookingId = String(booking.id ?? '').trim();
  const propertySlug = (extras.property_slug ?? extras.propertySlug ?? '').trim();
  const bookingLink = bookingId ? `${appOrigin}/bookings/${encodeURIComponent(bookingId)}` : '';
  const sdFormUrl =
    extras.sd_form_url?.trim() ||
    (bookingId ? guestSdFormPath(appOrigin, propertySlug, bookingId) : '');
  const formUrl =
    extras.form_url?.trim() || (bookingId ? guestFormPath(appOrigin, propertySlug, bookingId) : '');
  const reviewUrl =
    extras.review_url?.trim() ||
    (bookingId ? guestGuestReviewPath(appOrigin, propertySlug, bookingId) : '');
  const totalBalance =
    computeTotalGuestBalanceFromBooking(booking as unknown as Record<string, unknown>) ?? 0;

  const flags = decorFlags(booking);

  return {
    primary_guest_name: escapeHtml(booking.primary_guest_name),
    guest_name: escapeHtml(booking.primary_guest_name || booking.guest_facebook_name),
    guest_email: escapeHtml(booking.guest_email),
    guest_phone: escapeHtml(booking.guest_phone_number),
    guest_facebook_name: escapeHtml(booking.guest_facebook_name),
    check_in_date: escapeHtml(displayCheckIn),
    check_out_date: escapeHtml(displayCheckOut),
    check_in_time: escapeHtml(formatTimeForDisplay(booking.check_in_time, '2:00 PM')),
    check_out_time: escapeHtml(formatTimeForDisplay(booking.check_out_time, '11:00 AM')),
    nights: String(nights),
    pax: String(pax),
    tower_and_unit_number: escapeHtml(unitLabel),
    unit_number: escapeHtml(unitLabel),
    property_name: escapeHtml(propertyName),
    booking_source: escapeHtml(String(booking.booking_source ?? '')),
    booking_link: escapeHtml(bookingLink),
    special_requests: escapeHtml(String(booking.guest_special_requests ?? '').trim() || 'None'),
    pet_name: escapeHtml(String(booking.pet_name ?? '')),
    pet_type: escapeHtml(String(booking.pet_type ?? '')),
    pet_breed: escapeHtml(String(booking.pet_breed ?? '')),
    pet_age: escapeHtml(String(booking.pet_age ?? '')),
    car_brand_model: escapeHtml(String(booking.car_brand_model ?? '')),
    car_color: escapeHtml(String(booking.car_color ?? '')),
    car_plate_number: escapeHtml(String(booking.car_plate_number ?? '')),
    total_guest_balance: escapeHtml(formatPeso(totalBalance)),
    sd_form_url: escapeHtml(sdFormUrl),
    form_url: escapeHtml(formUrl),
    review_url: escapeHtml(reviewUrl),
    security_deposit: escapeHtml(formatPeso(booking.security_deposit as number | null)),
    ...Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, escapeHtml(v)])),
    ...extras,
  };
}

export function buildGuestFormPlaceholderVars(
  formData: GuestFormData,
  settings: AppSettingsResolved,
  extras: Record<string, string> = {},
  branding?: PropertyEmailBranding
): Record<string, string> {
  const displayCheckIn = formatDateForEmail(formData.checkInDate);
  const displayCheckOut = formatDateForEmail(formData.checkOutDate);
  const pax = formData.numberOfAdults + formData.numberOfChildren;
  const nights = countStayNights(formData.checkInDate, formData.checkOutDate);
  const unitLabel = branding
    ? resolveEmailUnitLabel(formData.towerAndUnitNumber, branding)
    : String(formData.towerAndUnitNumber ?? '').trim() ||
      settings.gafTowerAndUnitNumber?.trim() ||
      'Property';
  const propertyName = branding?.propertyName ?? 'Property';
  const hasDecor = Boolean(formData.guestRequestsSurpriseDecor);
  const hasPets = Boolean(formData.hasPets);

  return {
    primary_guest_name: escapeHtml(formData.primaryGuestName),
    guest_name: escapeHtml(formData.primaryGuestName || formData.guestFacebookName),
    guest_email: escapeHtml(formData.guestEmail),
    guest_phone: escapeHtml(formData.guestPhoneNumber),
    guest_facebook_name: escapeHtml(formData.guestFacebookName),
    check_in_date: escapeHtml(displayCheckIn),
    check_out_date: escapeHtml(displayCheckOut),
    check_in_time: escapeHtml(formatTimeForDisplay(formData.checkInTime, '2:00 PM')),
    check_out_time: escapeHtml(formatTimeForDisplay(formData.checkOutTime, '11:00 AM')),
    nights: String(nights),
    pax: String(pax),
    tower_and_unit_number: escapeHtml(unitLabel),
    unit_number: escapeHtml(unitLabel),
    property_name: escapeHtml(propertyName),
    booking_source: escapeHtml(String(formData.bookingSource ?? '')),
    special_requests: escapeHtml(String(formData.guestSpecialRequests ?? '').trim() || 'None'),
    pet_name: escapeHtml(String(formData.petName ?? '')),
    pet_type: escapeHtml(String(formData.petType ?? '')),
    pet_breed: escapeHtml(String(formData.petBreed ?? '')),
    pet_age: escapeHtml(String(formData.petAge ?? '')),
    pet_vaccination_date: escapeHtml(formatDateForEmail(formData.petVaccinationDate || '')),
    car_brand_model: escapeHtml(String(formData.carBrandModel ?? '')),
    car_color: escapeHtml(String(formData.carColor ?? '')),
    car_plate_number: escapeHtml(String(formData.carPlateNumber ?? '')),
    decor_status: escapeHtml(hasDecor ? '🎉 Yes' : 'No'),
    pet_status: escapeHtml(hasPets ? '🐶 Yes' : 'No'),
    has_decor: escapeHtml(hasDecor ? 'Yes' : 'No'),
    has_pets: escapeHtml(hasPets ? 'Yes' : 'No'),
    decor_flag: escapeHtml(hasDecor ? '🎉 Has decor' : ''),
    pet_flag: escapeHtml(hasPets ? '🐶 Has pets' : ''),
    ...extras,
  };
}

export async function renderPropertyTemplateSendEmail(input: {
  propertyId: string | undefined;
  /** Custom (`custom-*`) keys are only valid together with `contentOverride`. */
  templateKey: PropertyEmailTemplateKey | (string & {});
  emailTitle: string;
  placeholderVars: Record<string, string>;
  urgentBlock?: string;
  /** @deprecated Use {{update_notice}} in template body. */
  updateNoticeBlock?: string;
  branding?: PropertyEmailBranding;
  /** When set (preview), use this body instead of DB/default content. */
  contentOverride?: string;
}): Promise<string> {
  const settings = await resolveAppSettings(input.propertyId);
  const branding = input.branding ?? (await loadPropertyEmailBranding(input.propertyId));

  let rawContent = input.contentOverride?.trim() ?? '';
  if (!rawContent) {
    const resolved = await resolvePropertyTemplateContent(
      input.propertyId,
      input.templateKey as PropertyTemplateKey
    );
    rawContent = resolved.content;
  }

  if (!rawContent.trim()) {
    throw new Error(`Property email template "${input.templateKey}" has empty content`);
  }

  rawContent = normalizeBlockLevelPlaceholdersInHtml(rawContent);
  rawContent = normalizeEmailCalloutPlaceholders(rawContent, input.templateKey);

  let body = applyPropertyTemplatePlaceholders(rawContent, input.placeholderVars);
  body = prepareConfigurableEmailBodyHtml(body, settings.publicGuestAppOrigin);

  const bodyContent = body;

  const emailHeaderLogo = await emailHeaderLogoHtml(input.propertyId, branding.organizationName);
  const shell = await loadEmailTemplate('fragments/configurable-template-send');
  const unitLabel = input.placeholderVars.tower_and_unit_number || escapeHtml(branding.unitLabel);

  const title =
    input.emailTitle.trim() || getBuiltinPropertyTemplate(input.templateKey)?.label || 'Email';
  const legalFooter = `© ${branding.organizationName}. All rights reserved.`;
  const dateLineBlock = buildDateLineBlockHtml(
    input.placeholderVars.check_in_date ?? '',
    input.placeholderVars.check_out_date ?? '',
    settings.brandColor
  );

  return replacePlaceholders(
    shell,
    withEmailShellStyleVars(
      {
        emailHeaderLogo,
        brandName: escapeHtml(branding.organizationName),
        unitLabel,
        emailTitle: escapeHtml(title),
        dateLineBlock,
        bodyContent,
        legalFooter: escapeHtml(legalFooter),
      },
      settings.brandColor
    )
  );
}
