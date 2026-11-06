import { guestBookingEmailLinkPlaceholderExtras } from './guestBookingEmailLinks.ts';
import { resolveGuestParkingCtaAbsoluteUrl } from './ownerDefaultParking.ts';
import { buildGuestStayGuideUrl, propertyHasStayGuideAccess } from './guestStayGuide.ts';
import { buildApprovalInboundAddress } from './approvalInboundAddress.ts';
import { resolvePropertySlugById } from './propertyScope.ts';
import { createClient } from './supabaseJs.ts';
import type { GuestFormData, GuestSubmission } from './types.ts';
import {
  buildBookingLinkCtaHtml,
  buildBookingAcknowledgementFlowSectionHtml,
  buildDocumentRemindersSectionFromBooking,
  buildDownpaymentReceiptAiSectionFromBooking,
  buildEmailSignatureSectionHtml,
  buildGafUpdateNoticeHtml,
  buildGcashPaymentSectionHtml,
  buildNewBookingDetailTablesFromBooking,
  buildPaymentBreakdownSectionFromBooking,
  buildPetAttachmentsSectionHtml,
  buildPetDetailsSectionFromGuestForm,
  buildPetUpdateNoticeHtml,
  buildReadyForCheckinBookingSummaryFromBooking,
  buildReadyForCheckinContactSectionHtml,
  buildStayGuideCtaHtml,
  buildSdRefundChecklistSectionHtml,
  buildSdRefundDetailsSectionHtml,
  buildSdRefundFooterSectionHtml,
  buildUrgentSameDayCallout,
  computeReadyForCheckinTotalDue,
} from './propertyTemplateEmailSections.ts';
import { formatDateForEmail } from './utils.ts';
import { resolveAppSettings } from './appSettings.ts';
import { buildGuestFacingPlaceholderVars, loadGuestFacingContactInfo } from './guestContactInfo.ts';
import {
  buildBookingPlaceholderVars,
  buildGuestFormPlaceholderVars,
  renderPropertyTemplateSendEmail,
} from './propertyTemplateEmail.ts';
import { loadBookingEmailDisplayContext } from './emailBookingContext.ts';
import {
  formatEmailDateRange,
  formatResendFromAddress,
  loadPropertyEmailBranding,
  resolveEmailUnitLabel,
  sanitizeAttachmentToken,
} from './propertyEmailBranding.ts';
import { buildEmailCtaHtml, renderBrandedEmailShell } from './brandedEmailShell.ts';
import { isEmailSuppressed } from './emailSuppression.ts';
import { PLATFORM_BRAND_NAME } from './platformBrand.ts';
import { escapeHtml } from './renderEmailHtml.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { buildSupportTicketThreadUrl } from './supportTicketStatus.ts';
import { sendResendEmail } from './sendResendEmail.ts';

/** Resolve property scope for operator settings (email routing, GCash, logos, etc.). */

import { captureSentryMessage } from './sentry.ts';
export function resolveEmailPropertyId(
  booking?: { property_id?: string | null } | null
): string | undefined {
  const id = booking?.property_id?.trim();
  return id || undefined;
}

// ─── Shared storage helpers ───────────────────────────────────────────────────

function supabaseAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

/**
 * Parse a Supabase Storage public URL into { bucket, path }.
 * Returns null for placeholder values or unparseable URLs.
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    if (
      !url ||
      url === 'dev-mode-skipped' ||
      url === 'test-mode-skipped' ||
      !url.startsWith('http')
    ) {
      return null;
    }
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/');
    // Support both /storage/v1/object/public/… and /storage/v1/object/sign/…
    const markerIdx = parts.findIndex((p) => p === 'public' || p === 'sign');
    if (markerIdx !== -1 && markerIdx < parts.length - 2) {
      const bucket = parts[markerIdx + 1];
      const path = parts.slice(markerIdx + 2).join('/');
      return { bucket, path };
    }
    return null;
  } catch {
    return null;
  }
}

type DownloadedFile = {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
};

/**
 * Download a file from Supabase Storage using the service role key.
 * Works for both public and private buckets.
 */
async function downloadStorageFile(
  url: string,
  fallbackFilename: string
): Promise<DownloadedFile | null> {
  const loc = parseStorageUrl(url);
  if (!loc) {
    console.warn('[emailService] Cannot parse storage URL:', url);
    return null;
  }

  try {
    const { data, error } = await supabaseAdminClient().storage.from(loc.bucket).download(loc.path);

    if (error || !data) {
      console.error('[emailService] Storage download failed:', error?.message);
      void captureSentryMessage('email attachment download failed', {
        logPrefix: 'emailService',
        level: 'warning',
        tags: { provider: 'supabase_storage', side_effect: 'email_attachment' },
        fingerprint: ['provider', 'supabase_storage', 'download'],
      });
      return null;
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    const filename = loc.path.split('/').pop() || fallbackFilename;
    const mimeType = data.type || 'application/octet-stream';
    return { bytes, filename, mimeType };
  } catch (err) {
    console.error('[emailService] Unexpected download error:', err);
    return null;
  }
}

/**
 * Convert file bytes to a base64 string for Resend attachments.
 */
function toBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunkSize))));
  }
  return btoa(chunks.join(''));
}

/** `content_id` prefix for Resend inline payment QR images (`cid:payment-qr-<methodId>`). */
const READY_FOR_CHECKIN_PAYMENT_QR_CONTENT_ID_PREFIX = 'payment-qr-';

type ReadyForCheckinQrAsset = {
  methodId: string;
  bytes: Uint8Array;
  contentType: string;
  filename: string;
  contentId: string;
};

async function fetchPaymentQrBytes(
  url: string
): Promise<{ bytes: Uint8Array; contentType: string; filename: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[emailService] Payment QR fetch failed:', res.status, url);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0) return null;
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    return { bytes, contentType, filename: `payment-qr.${ext}` };
  } catch (err) {
    console.warn('[emailService] Payment QR fetch error:', err);
    return null;
  }
}

async function resolveReadyForCheckinPaymentQrs(
  settings: Awaited<ReturnType<typeof resolveAppSettings>>
): Promise<{ assets: ReadyForCheckinQrAsset[]; qrSrcByMethodId: Record<string, string> }> {
  const methods =
    settings.paymentMethods?.length > 0
      ? settings.paymentMethods
      : settings.gcashQrImageUrl
        ? [
            {
              id: 'legacy',
              provider: settings.paymentProvider,
              accountName: settings.gcashName,
              accountNumber: settings.gcashNumber,
              qrImageUrl: settings.gcashQrImageUrl,
              isPrimary: true,
            },
          ]
        : [];

  const assets: ReadyForCheckinQrAsset[] = [];
  const qrSrcByMethodId: Record<string, string> = {};

  for (const method of methods) {
    const url = (method.qrImageUrl ?? '').trim();
    if (!url || url.includes('kame-home-gcash-qr-payment')) continue;
    const fetched = await fetchPaymentQrBytes(url);
    if (!fetched) {
      qrSrcByMethodId[method.id] = url;
      continue;
    }
    const contentId = `${READY_FOR_CHECKIN_PAYMENT_QR_CONTENT_ID_PREFIX}${method.id}`;
    assets.push({
      methodId: method.id,
      bytes: fetched.bytes,
      contentType: fetched.contentType,
      filename: fetched.filename,
      contentId,
    });
    qrSrcByMethodId[method.id] = `cid:${contentId}`;
  }

  return { assets, qrSrcByMethodId };
}

type ResendAttachment = {
  filename: string;
  content: string;
  encoding: string;
  content_id?: string;
  content_type?: string;
};

/**
 * Checks if a booking is urgent (same-day check-in)
 * @param checkInDate - Check-in date in MM-DD-YYYY or YYYY-MM-DD format
 * @returns true if check-in is today (in Philippine timezone UTC+8)
 */
function isUrgentBooking(checkInDate: string): boolean {
  try {
    console.log('🔍 Checking if booking is urgent...');

    // Parse the check-in date (supports both MM-DD-YYYY and YYYY-MM-DD formats)
    let checkInDateStr = checkInDate;

    // If date is in MM-DD-YYYY format, convert to YYYY-MM-DD
    if (checkInDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [month, day, year] = checkInDate.split('-');
      checkInDateStr = `${year}-${month}-${day}`;
      console.log('  Converted to YYYY-MM-DD:', checkInDateStr);
    }

    // Get today's date in Philippine timezone (UTC+8)
    const philippineTime = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
    );
    const todayStr =
      philippineTime.getFullYear() +
      '-' +
      String(philippineTime.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(philippineTime.getDate()).padStart(2, '0');

    console.log("  Today's date (Philippine time):", todayStr);
    console.log('  Check-in date (normalized):', checkInDateStr);
    console.log('  Is urgent:', checkInDateStr === todayStr);

    return checkInDateStr === todayStr;
  } catch (error) {
    console.error('❌ Error checking if booking is urgent:', error);
    return false;
  }
}

/**
 * Same-day check-in (Asia/Manila) — **subject line** prefix for ops-facing
 * mail (GAF, Pet, Parking broadcast, **New Booking Request** notify to
 * `EMAIL_REPLY_TO`). Guest-facing templates (acknowledgement, check-in details,
 * SD refund form request subject, etc.) do not use this prefix on the subject.
 */
function urgentEmailSubjectPrefix(isUrgent: boolean): string {
  return isUrgent ? '🚨 URGENT - ' : '';
}

function sanitizeAttachmentLabel(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return cleaned || 'guest';
}

type GuestValidIdBookingFields = Pick<
  GuestSubmission,
  | 'check_in_date'
  | 'primary_guest_name'
  | 'guest2_name'
  | 'guest3_name'
  | 'guest4_name'
  | 'guest5_name'
  | 'valid_id_url'
  | 'guest2_valid_id_url'
  | 'guest3_valid_id_url'
  | 'guest4_valid_id_url'
  | 'guest5_valid_id_url'
  | 'property_id'
>;

/**
 * Download each stored guest valid ID and build Resend attachments for the
 * Azure GAF request email (primary + guests 2–5 when URLs exist).
 */
async function buildGuestValidIdAttachments(
  booking: GuestValidIdBookingFields,
  fileTokenPrefix: string
): Promise<ResendAttachment[]> {
  const checkIn = booking.check_in_date || 'unknown';
  const slots = [
    {
      label: 'PRIMARY',
      url: booking.valid_id_url,
      name: booking.primary_guest_name || 'primary',
    },
    {
      label: 'GUEST2',
      url: booking.guest2_valid_id_url,
      name: booking.guest2_name || 'guest2',
    },
    {
      label: 'GUEST3',
      url: booking.guest3_valid_id_url,
      name: booking.guest3_name || 'guest3',
    },
    {
      label: 'GUEST4',
      url: booking.guest4_valid_id_url,
      name: booking.guest4_name || 'guest4',
    },
    {
      label: 'GUEST5',
      url: booking.guest5_valid_id_url,
      name: booking.guest5_name || 'guest5',
    },
  ];

  const attachments: ResendAttachment[] = [];

  for (const slot of slots) {
    const url = slot.url?.trim();
    if (!url) continue;

    const file = await downloadStorageFile(
      url,
      `${fileTokenPrefix}_VALID_ID_${slot.label}-${checkIn}.jpg`
    );
    if (!file) {
      console.warn(`[emailService] Skipping valid ID attachment (${slot.label}): download failed`);
      continue;
    }

    const ext = file.filename.includes('.') ? file.filename.split('.').pop()! : 'jpg';
    const namePart = sanitizeAttachmentLabel(slot.name);
    attachments.push({
      filename: `${fileTokenPrefix}_VALID_ID_${namePart}-${checkIn}.${ext}`,
      content: toBase64(file.bytes),
      encoding: 'base64',
      content_type: file.mimeType,
    });
    console.log(
      `[emailService] Valid ID attached for ${slot.label}:`,
      attachments[attachments.length - 1]!.filename
    );
  }

  return attachments;
}

export async function sendEmail(
  formData: GuestFormData,
  pdfBuffer: Uint8Array | null,
  isUpdate = false,
  booking?: GuestValidIdBookingFields | null
) {
  console.log(`Sending ${isUpdate ? 'update' : 'confirmation'} email...`);

  const propertyId = resolveEmailPropertyId(booking);
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const settings = await resolveAppSettings(propertyId);
  const EMAIL_TO = settings.emailTo;
  const EMAIL_REPLY_TO = settings.emailReplyTo;

  if (!RESEND_API_KEY) {
    console.error(' Missing RESEND_API_KEY environment variable');
    throw new Error('Missing RESEND_API_KEY environment variable');
  }

  if (!EMAIL_TO) {
    console.error(' Missing emailTo in property app_settings');
    throw new Error('Missing emailTo in property app_settings');
  }

  if (!EMAIL_REPLY_TO) {
    console.error(' Missing emailReplyTo in property app_settings');
    throw new Error('Missing emailReplyTo in property app_settings');
  }

  const isUrgent = isUrgentBooking(formData.checkInDate);
  const urgentPrefix = urgentEmailSubjectPrefix(isUrgent);

  if (isUrgent) {
    console.log('🚨 URGENT BOOKING DETECTED - Same-day check-in!');
  }

  const displayCheckInDate = formatDateForEmail(formData.checkInDate);
  const displayCheckOutDate = formatDateForEmail(formData.checkOutDate);

  const branding = await loadPropertyEmailBranding(propertyId);
  const unitLabel = resolveEmailUnitLabel(formData.towerAndUnitNumber, branding);
  const fileToken = sanitizeAttachmentToken(unitLabel);

  const vars = buildGuestFormPlaceholderVars(
    formData,
    settings,
    {
      urgent_notice: buildUrgentSameDayCallout(isUrgent),
      update_notice: isUpdate ? buildGafUpdateNoticeHtml(unitLabel) : '',
      email_signature_section: buildEmailSignatureSectionHtml(settings.gafUnitOwner, unitLabel),
    },
    branding
  );

  const emailContent = await renderPropertyTemplateSendEmail({
    propertyId,
    templateKey: 'email-gaf-request',
    emailTitle: isUpdate ? 'Guest Advise Form Request (Updated)' : 'Guest Advise Form Request',
    placeholderVars: vars,
    branding,
  });

  const base64PDF = pdfBuffer ? toBase64(pdfBuffer) : null;

  const attachments: ResendAttachment[] = [];
  if (base64PDF) {
    attachments.push({
      filename: `${fileToken}_GAF-${formData.checkInDate}.pdf`,
      content: base64PDF,
      encoding: 'base64',
      content_type: 'application/pdf',
    });
  }

  if (booking) {
    const validIdAttachments = await buildGuestValidIdAttachments(booking, fileToken);
    attachments.push(...validIdAttachments);
  }

  console.log(`Sending GAF email with ${attachments.length} attachment(s)...`);
  attachments.forEach((att, index) => {
    console.log(`  Attachment ${index + 1}: ${att.filename}`);
  });

  const updatePrefix = isUpdate ? 'UPDATED - ' : '';

  const propertySlug = propertyId ? await resolvePropertySlugById(propertyId) : null;
  const inboundReplyTo =
    (propertySlug ? buildApprovalInboundAddress(propertySlug) : null) ?? EMAIL_REPLY_TO;
  // Ops keeps a human copy; Azure Reply-To routes into approval-email-webhook.
  // Never CC the guest — per booking-workflow.mdc §3.
  const cc = inboundReplyTo !== EMAIL_REPLY_TO && EMAIL_REPLY_TO ? [EMAIL_REPLY_TO] : undefined;

  const sent = await sendResendEmail({
    from: formatResendFromAddress(`${unitLabel} - GAF Request`, branding.fromEmail),
    to: [EMAIL_TO],
    reply_to: inboundReplyTo,
    ...(cc ? { cc } : {}),
    subject: `${urgentPrefix}${updatePrefix}${unitLabel} - GAF Request ${formatEmailDateRange(displayCheckInDate, displayCheckOutDate)}`,
    html: emailContent,
    ...(attachments.length > 0 ? { attachments } : {}),
    errorLabel: 'email',
  });

  console.log('Email sent successfully');
  return sent;
}

export async function sendPetEmail(
  formData: GuestFormData,
  pdfBuffer: Uint8Array | null,
  petImageUrl?: string,
  petVaccinationUrl?: string,
  isUpdate = false,
  propertyId?: string | null
) {
  console.log(`Sending pet ${isUpdate ? 'update' : 'request'} email...`);
  console.log('Pet Image URL:', petImageUrl);
  console.log('Pet Vaccination URL:', petVaccinationUrl);

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const settings = await resolveAppSettings(propertyId);
  const EMAIL_TO = settings.emailTo;
  const EMAIL_REPLY_TO = settings.emailReplyTo;

  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY environment variable');
    throw new Error('Missing RESEND_API_KEY environment variable');
  }

  if (!EMAIL_TO) {
    console.error('Missing emailTo in property app_settings');
    throw new Error('Missing emailTo in property app_settings');
  }

  if (!EMAIL_REPLY_TO) {
    console.error('Missing emailReplyTo in property app_settings');
    throw new Error('Missing emailReplyTo in property app_settings');
  }

  const displayCheckInDate = formatDateForEmail(formData.checkInDate);
  const displayCheckOutDate = formatDateForEmail(formData.checkOutDate);

  const branding = await loadPropertyEmailBranding(propertyId);
  const unitLabel = resolveEmailUnitLabel(formData.towerAndUnitNumber, branding);
  const fileToken = sanitizeAttachmentToken(unitLabel);

  const isUrgent = isUrgentBooking(formData.checkInDate);
  const urgentPrefix = urgentEmailSubjectPrefix(isUrgent);

  if (isUrgent) {
    console.log('🚨 URGENT PET BOOKING DETECTED - Same-day check-in!');
  }

  const vars = buildGuestFormPlaceholderVars(
    formData,
    settings,
    {
      urgent_notice: buildUrgentSameDayCallout(isUrgent),
      update_notice: isUpdate ? buildPetUpdateNoticeHtml(unitLabel) : '',
      pet_details_section: buildPetDetailsSectionFromGuestForm(formData, settings.brandColor),
      pet_attachments_section: buildPetAttachmentsSectionHtml(settings.brandColor),
      email_signature_section: buildEmailSignatureSectionHtml(settings.gafUnitOwner, unitLabel),
    },
    branding
  );

  const emailContent = await renderPropertyTemplateSendEmail({
    propertyId: propertyId ?? undefined,
    templateKey: 'email-pet-request',
    emailTitle: isUpdate ? 'Pet Registration Request (Updated)' : 'Pet Registration Request',
    placeholderVars: vars,
    branding,
  });

  // Prepare attachments array
  const attachments: any[] = [];

  // Add Pet PDF if available
  if (pdfBuffer) {
    attachments.push({
      filename: `${fileToken}_PET_FORM-${formData.checkInDate}.pdf`,
      content: toBase64(pdfBuffer),
      encoding: 'base64',
    });
  }

  // Download and attach pet image if URL is provided
  if (petImageUrl) {
    const file = await downloadStorageFile(petImageUrl, `pet-image-${formData.checkInDate}.jpg`);
    if (file) {
      attachments.push({
        filename: file.filename,
        content: toBase64(file.bytes),
        encoding: 'base64',
      });
      console.log('Pet image attached successfully:', file.filename);
    }
  }

  // Download and attach pet vaccination if URL is provided
  if (petVaccinationUrl) {
    const file = await downloadStorageFile(
      petVaccinationUrl,
      `pet-vaccination-${formData.checkInDate}.jpg`
    );
    if (file) {
      attachments.push({
        filename: file.filename,
        content: toBase64(file.bytes),
        encoding: 'base64',
      });
      console.log('Pet vaccination record attached successfully:', file.filename);
    }
  }

  console.log(`Sending pet email with ${attachments.length} attachment(s)...`);
  attachments.forEach((att, index) => {
    console.log(`  Attachment ${index + 1}: ${att.filename} (${att.content.length} chars base64)`);
  });

  const updatePrefix = isUpdate ? 'UPDATED - ' : '';

  const petPropertyId = propertyId ?? null;
  const propertySlug = petPropertyId ? await resolvePropertySlugById(petPropertyId) : null;
  const inboundReplyTo =
    (propertySlug ? buildApprovalInboundAddress(propertySlug) : null) ?? EMAIL_REPLY_TO;
  const cc = inboundReplyTo !== EMAIL_REPLY_TO && EMAIL_REPLY_TO ? [EMAIL_REPLY_TO] : undefined;

  const sent = await sendResendEmail({
    from: formatResendFromAddress(`${unitLabel} - Pet Request`, branding.fromEmail),
    to: [EMAIL_TO],
    reply_to: inboundReplyTo,
    ...(cc ? { cc } : {}),
    subject: `${urgentPrefix}${updatePrefix}${unitLabel} - Pet Request ${formatEmailDateRange(displayCheckInDate, displayCheckOutDate)}`,
    html: emailContent,
    attachments: attachments,
    errorLabel: 'email',
  });

  console.log('Pet email sent successfully');
  return sent;
}

// ─── New Phase 3 emails ──────────────────────────────────────────────────────

async function getResendCredentials(propertyId?: string | null) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const settings = await resolveAppSettings(propertyId);
  const EMAIL_TO = settings.emailTo;
  const EMAIL_REPLY_TO = settings.emailReplyTo;

  if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  if (!EMAIL_TO) throw new Error('Missing emailTo in property app_settings');
  if (!EMAIL_REPLY_TO) {
    throw new Error('Missing emailReplyTo in property app_settings');
  }

  return { RESEND_API_KEY, EMAIL_TO, EMAIL_REPLY_TO, settings };
}

function pesoFormat(amount: number | null | undefined): string {
  if (amount == null) return '-';
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function loadGuestBookingEmailLinkExtras(
  booking: GuestSubmission,
  settings: Awaited<ReturnType<typeof resolveAppSettings>>
): Promise<Record<string, string>> {
  const bookingId = String(booking.id ?? '').trim();
  if (!bookingId) return {};

  const propertyId = resolveEmailPropertyId(booking);
  const propertySlug = propertyId ? ((await resolvePropertySlugById(propertyId)) ?? '') : '';

  return await guestBookingEmailLinkPlaceholderExtras({
    origin: settings.publicGuestAppOrigin,
    propertySlug,
    bookingId,
  });
}

async function getResendNewBookingNotifyCredentials(propertyId?: string | null) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const settings = await resolveAppSettings(propertyId);
  const EMAIL_REPLY_TO = settings.emailReplyTo;
  if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  if (!EMAIL_REPLY_TO) {
    throw new Error('Missing emailReplyTo in property app_settings');
  }
  return { RESEND_API_KEY, EMAIL_REPLY_TO, settings };
}

/**
 * **Owner / ops notify** — sent only to `EMAIL_REPLY_TO` when a guest saves the public form (`submit-form`).
 * Not a workflow transition email; failures are logged as non-fatal in `submit-form`.
 */
export async function sendNewBookingRequestNotify(booking: GuestSubmission) {
  const bookingId = booking.id as string | undefined;
  if (!bookingId) throw new Error('sendNewBookingRequestNotify: booking.id is required');

  console.log('Sending new booking request notify email to EMAIL_REPLY_TO...');

  const propertyId = resolveEmailPropertyId(booking);
  const { EMAIL_REPLY_TO, settings } = await getResendNewBookingNotifyCredentials(propertyId);
  const { branding, unitLabel, displayCheckInDate, displayCheckOutDate } =
    await loadBookingEmailDisplayContext(propertyId, booking);

  const isUrgent = isUrgentBooking(booking.check_in_date);
  const urgentPrefix = urgentEmailSubjectPrefix(isUrgent);
  if (isUrgent) {
    console.log('🚨 URGENT same-day check-in - new booking request notify');
  }

  const appOrigin = settings.publicGuestAppOrigin.replace(/\/+$/, '');
  const bookingLink = `${appOrigin}/bookings/${encodeURIComponent(bookingId)}`;

  const vars = buildBookingPlaceholderVars(
    booking,
    settings,
    {
      urgent_notice: buildUrgentSameDayCallout(isUrgent),
      new_booking_detail_tables: buildNewBookingDetailTablesFromBooking(
        booking,
        settings.brandColor
      ),
      downpayment_receipt_ai_section: buildDownpaymentReceiptAiSectionFromBooking(
        booking,
        settings.brandColor
      ),
      booking_link_cta: buildBookingLinkCtaHtml(bookingLink, settings.brandColor),
    },
    branding
  );

  const html = await renderPropertyTemplateSendEmail({
    propertyId,
    templateKey: 'email-new-booking-request',
    emailTitle: `${urgentPrefix}New Booking Request`.trim(),
    placeholderVars: vars,
    branding,
  });

  const sent = await sendResendEmail({
    from: formatResendFromAddress(
      `${unitLabel} - ${branding.organizationName}`,
      branding.fromEmail
    ),
    to: [EMAIL_REPLY_TO],
    reply_to: booking.guest_email,
    subject: `${urgentPrefix}${unitLabel} - New Booking Request ${formatEmailDateRange(displayCheckInDate, displayCheckOutDate)}`,
    html,
    errorLabel: 'email',
  });

  const body = sent;
  console.log(
    '[new-booking-notify] Resend accepted message; id:',
    body?.id ?? '(no id in response)',
    '| to: EMAIL_REPLY_TO from property app_settings (check spam / Resend dashboard if inbox empty)'
  );
  return body;
}

/**
 * Booking acknowledgement — sent to the **guest** when moving PENDING_REVIEW → PENDING_GAF.
 * Confirms we received the form and are processing their GAF.
 */
export async function sendBookingAcknowledgement(booking: GuestSubmission) {
  console.log('Sending booking acknowledgement email to guest...');

  if (await isEmailSuppressed(booking.guest_email)) {
    console.warn('[emailService] Skipping booking acknowledgement - guest email is suppressed');
    return { skipped: true, reason: 'suppressed' };
  }

  const propertyId = resolveEmailPropertyId(booking);
  const { EMAIL_REPLY_TO, settings } = await getResendCredentials(propertyId);
  const { branding, unitLabel, displayCheckInDate, displayCheckOutDate } =
    await loadBookingEmailDisplayContext(propertyId, booking);

  const guestName = String(booking.guest_facebook_name ?? '').trim() || 'Guest';

  const guestContact = await loadGuestFacingContactInfo(propertyId, settings);
  const guestLinkExtras = await loadGuestBookingEmailLinkExtras(booking, settings);

  const parkingUrl = booking.need_parking
    ? await resolveGuestParkingCtaAbsoluteUrl({
        propertyBookingId: String(booking.id ?? ''),
        publicGuestAppOrigin: settings.publicGuestAppOrigin,
      })
    : null;

  const html = await renderPropertyTemplateSendEmail({
    propertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: `Thank you, ${guestName}!`,
    placeholderVars: buildBookingPlaceholderVars(
      booking,
      settings,
      {
        ...guestLinkExtras,
        ...buildGuestFacingPlaceholderVars(guestContact),
        booking_acknowledgement_flow_section: buildBookingAcknowledgementFlowSectionHtml({
          unitLabel,
          checkIn: displayCheckInDate,
          checkOut: displayCheckOutDate,
          brandColor: settings.brandColor,
          contact: guestContact,
          parkingUrl,
          tripUrl: guestLinkExtras.trip_url,
        }),
        email_signature_section: buildEmailSignatureSectionHtml(settings.gafUnitOwner, unitLabel),
      },
      branding
    ),
    branding,
  });

  const sent = await sendResendEmail({
    from: formatResendFromAddress(
      `${unitLabel} - ${branding.organizationName}`,
      branding.fromEmail
    ),
    to: [booking.guest_email],
    reply_to: EMAIL_REPLY_TO,
    subject: `${unitLabel} - Booking Acknowledgement ${formatEmailDateRange(displayCheckInDate, displayCheckOutDate)}`,
    html,
    errorLabel: 'email',
  });

  console.log('Booking acknowledgement email sent successfully');
  return sent;
}

/**
 * Ready for check-in — sent to the **guest** when transitioning to READY_FOR_CHECKIN.
 * Includes payment breakdown, important reminders, and any relevant approved documents as attachments:
 *   • Approved GAF PDF (always, if available)
 *   • Approved Pet PDF (if has_pets and available)
 *   • Parking endorsement (if need_parking and available)
 */
export async function sendReadyForCheckin(booking: GuestSubmission) {
  console.log('Sending ready-for-check-in email to guest...');

  if (await isEmailSuppressed(booking.guest_email)) {
    console.warn('[emailService] Skipping ready-for-check-in - guest email is suppressed');
    return { skipped: true, reason: 'suppressed' };
  }

  const propertyId = resolveEmailPropertyId(booking);
  const { EMAIL_REPLY_TO, settings } = await getResendCredentials(propertyId);
  const { branding, unitLabel, displayCheckInDate, displayCheckOutDate } =
    await loadBookingEmailDisplayContext(propertyId, booking);

  const totalDueAtCheckin = computeReadyForCheckinTotalDue(booking);
  const showPaymentSections = totalDueAtCheckin > 0;

  let qrSrcByMethodId: Record<string, string> = {};
  let qrAssets: ReadyForCheckinQrAsset[] = [];

  if (showPaymentSections) {
    const resolved = await resolveReadyForCheckinPaymentQrs(settings);
    qrAssets = resolved.assets;
    qrSrcByMethodId = resolved.qrSrcByMethodId;
  }

  const guestContact = await loadGuestFacingContactInfo(propertyId, settings);
  const guestLinkExtras = await loadGuestBookingEmailLinkExtras(booking, settings);

  const stayGuideToken = String(
    (booking as { stay_guide_token?: string | null }).stay_guide_token ?? ''
  ).trim();
  let stayGuideUrl = '';
  // No CTA below Pro: the guide page would refuse the guest (`propertyShowcase`).
  if (stayGuideToken && propertyId && (await propertyHasStayGuideAccess(propertyId))) {
    stayGuideUrl = (await buildGuestStayGuideUrl(booking, stayGuideToken)) ?? '';
  }

  const dynamicSections: Record<string, string> = {
    ready_for_checkin_booking_summary_section: buildReadyForCheckinBookingSummaryFromBooking(
      booking,
      branding,
      settings.brandColor
    ),
    document_reminders_section: buildDocumentRemindersSectionFromBooking(
      booking,
      settings.brandColor
    ),
    payment_breakdown_section: showPaymentSections
      ? buildPaymentBreakdownSectionFromBooking(
          booking,
          pesoFormat,
          totalDueAtCheckin,
          settings.brandColor
        )
      : '',
    gcash_payment_section: showPaymentSections
      ? buildGcashPaymentSectionHtml(settings, qrSrcByMethodId)
      : '',
    ready_for_checkin_contact_section: buildReadyForCheckinContactSectionHtml(
      guestContact,
      settings.brandColor
    ),
    stay_guide_cta_section: buildStayGuideCtaHtml(stayGuideUrl, settings.brandColor),
    email_signature_section: buildEmailSignatureSectionHtml(settings.gafUnitOwner, unitLabel),
  };

  const html = await renderPropertyTemplateSendEmail({
    propertyId,
    templateKey: 'email-ready-for-checkin',
    emailTitle: "You're all set & ready for check-in!",
    placeholderVars: buildBookingPlaceholderVars(
      booking,
      settings,
      {
        ...guestLinkExtras,
        ...buildGuestFacingPlaceholderVars(guestContact),
        ...dynamicSections,
      },
      branding
    ),
    branding,
  });

  // ── Build attachments ─────────────────────────────────────────────────────────
  const attachments: ResendAttachment[] = [];

  if (showPaymentSections && qrAssets.length > 0) {
    for (const asset of qrAssets) {
      attachments.push({
        filename: asset.filename,
        content: toBase64(asset.bytes),
        encoding: 'base64',
        content_type: asset.contentType,
        content_id: asset.contentId,
      });
    }
    console.log(`[readyForCheckin] Inline payment QR x${qrAssets.length} (CID attachment)`);
  }

  // Approved GAF PDF — always attach if available
  if (booking.approved_gaf_pdf_url) {
    console.log('[readyForCheckin] Downloading approved GAF PDF...');
    const file = await downloadStorageFile(
      booking.approved_gaf_pdf_url,
      `approved-gaf-${booking.check_in_date}.pdf`
    );
    if (file) {
      attachments.push({
        filename: file.filename,
        content: toBase64(file.bytes),
        encoding: 'base64',
      });
      console.log('[readyForCheckin] Attached approved GAF PDF:', file.filename);
    }
  }

  // Approved Pet PDF — attach if booking has pets
  if (booking.has_pets && booking.approved_pet_pdf_url) {
    console.log('[readyForCheckin] Downloading approved pet PDF...');
    const file = await downloadStorageFile(
      booking.approved_pet_pdf_url,
      `approved-pet-form-${booking.check_in_date}.pdf`
    );
    if (file) {
      attachments.push({
        filename: file.filename,
        content: toBase64(file.bytes),
        encoding: 'base64',
      });
      console.log('[readyForCheckin] Attached approved pet PDF:', file.filename);
    }
  }

  // Parking endorsement — attach if booking has parking
  if (booking.need_parking && booking.parking_endorsement_url) {
    console.log('[readyForCheckin] Downloading parking endorsement...');
    const file = await downloadStorageFile(
      booking.parking_endorsement_url,
      `parking-endorsement-${booking.check_in_date}.pdf`
    );
    if (file) {
      attachments.push({
        filename: file.filename,
        content: toBase64(file.bytes),
        encoding: 'base64',
      });
      console.log('[readyForCheckin] Attached parking endorsement:', file.filename);
    }
  }

  console.log(`[readyForCheckin] Sending email with ${attachments.length} attachment(s)...`);

  const sent = await sendResendEmail({
    from: formatResendFromAddress(
      `${unitLabel} - ${branding.organizationName}`,
      branding.fromEmail
    ),
    to: [booking.guest_email],
    reply_to: EMAIL_REPLY_TO,
    subject: `${unitLabel} - Check-in Details ${formatEmailDateRange(displayCheckInDate, displayCheckOutDate)}`,
    html,
    ...(attachments.length > 0 ? { attachments } : {}),
    errorLabel: 'email',
  });

  console.log('Ready-for-check-in email sent successfully');
  return sent;
}

/**
 * Check-out & SD Refund Details — email guest a link to `/sd-form` (security deposit refund stepper).
 * Sent from `sd-refund-cron` when the pre-checkout **lead** window opens (independent of balance settlement),
 * on `READY_FOR_CHECKIN` → `READY_FOR_CHECKOUT` transitions when enabled, and via admin re-send.
 */
export async function sendSdRefundFormRequest(booking: GuestSubmission) {
  console.log('Sending SD refund form request email to guest...');

  if (await isEmailSuppressed(booking.guest_email)) {
    console.warn('[emailService] Skipping SD refund form request - guest email is suppressed');
    return { skipped: true, reason: 'suppressed' };
  }

  const propertyId = resolveEmailPropertyId(booking);
  const { EMAIL_REPLY_TO, settings } = await getResendCredentials(propertyId);
  const { branding, unitLabel, displayCheckInDate, displayCheckOutDate } =
    await loadBookingEmailDisplayContext(propertyId, booking);
  const securityDepositFormatted = pesoFormat(booking.security_deposit as number | null);

  const bookingId = booking.id as string;
  if (!bookingId) throw new Error('sendSdRefundFormRequest: booking.id is required');

  const guestLinkExtras = await loadGuestBookingEmailLinkExtras(booking, settings);
  const sdFormUrl = guestLinkExtras.sd_form_url ?? '';

  const guestContact = await loadGuestFacingContactInfo(propertyId, settings);

  const sdRefundSections = {
    sd_refund_checklist_section: buildSdRefundChecklistSectionHtml({
      unitLabel,
      brandColor: settings.brandColor,
    }),
    sd_refund_details_section: buildSdRefundDetailsSectionHtml({
      securityDepositFormatted,
      sdFormUrl,
      brandColor: settings.brandColor,
    }),
    /** Backward compat for saved templates still using the combined placeholder. */
    sd_refund_footer_section: buildSdRefundFooterSectionHtml({
      unitLabel,
      securityDepositFormatted,
      sdFormUrl,
      brandColor: settings.brandColor,
    }),
  };

  const html = await renderPropertyTemplateSendEmail({
    propertyId,
    templateKey: 'email-sd-refund-form-request',
    emailTitle: 'Check-out & SD Refund Details',
    placeholderVars: buildBookingPlaceholderVars(
      booking,
      settings,
      {
        ...guestLinkExtras,
        ...buildGuestFacingPlaceholderVars(guestContact),
        ...sdRefundSections,
      },
      branding
    ),
    branding,
  });

  const sent = await sendResendEmail({
    from: formatResendFromAddress(
      `${unitLabel} - ${branding.organizationName}`,
      branding.fromEmail
    ),
    to: [booking.guest_email],
    reply_to: EMAIL_REPLY_TO,
    subject: `${unitLabel} - Check-out & SD Refund Details ${formatEmailDateRange(displayCheckInDate, displayCheckOutDate)}`,
    html,
    errorLabel: 'email',
  });

  console.log('SD refund form request email sent successfully');
  return sent;
}

/**
 * Manual send of a saved custom template to a booking's guest.
 * Unlike the fixed workflow email kinds, this is not tied to a booking status
 * or an automation toggle — an operator picks the booking and sends on demand.
 */
export async function sendPropertyCustomTemplateEmail(
  booking: GuestSubmission,
  templateKey: string,
  templateName: string,
  content: string
) {
  console.log(`Sending custom template "${templateKey}" to guest...`);

  if (await isEmailSuppressed(booking.guest_email)) {
    console.warn('[emailService] Skipping custom template send - guest email is suppressed');
    return { skipped: true, reason: 'suppressed' };
  }

  const propertyId = resolveEmailPropertyId(booking);
  const { EMAIL_REPLY_TO, settings } = await getResendCredentials(propertyId);
  const { branding, unitLabel, displayCheckInDate, displayCheckOutDate } =
    await loadBookingEmailDisplayContext(propertyId, booking);

  const guestContact = await loadGuestFacingContactInfo(propertyId, settings);
  const guestLinkExtras = await loadGuestBookingEmailLinkExtras(booking, settings);

  const html = await renderPropertyTemplateSendEmail({
    propertyId,
    templateKey,
    emailTitle: templateName,
    placeholderVars: buildBookingPlaceholderVars(
      booking,
      settings,
      {
        ...guestLinkExtras,
        ...buildGuestFacingPlaceholderVars(guestContact),
        email_signature_section: buildEmailSignatureSectionHtml(settings.gafUnitOwner, unitLabel),
      },
      branding
    ),
    branding,
    contentOverride: content,
  });

  const sent = await sendResendEmail({
    from: formatResendFromAddress(
      `${unitLabel} - ${branding.organizationName}`,
      branding.fromEmail
    ),
    to: [booking.guest_email],
    reply_to: EMAIL_REPLY_TO,
    subject: `${unitLabel} - ${templateName} ${formatEmailDateRange(displayCheckInDate, displayCheckOutDate)}`,
    html,
    errorLabel: 'email',
  });

  console.log('Custom template email sent successfully');
  return sent;
}

// ─── Help & Support — ticket notify (Module 3) ───────────────────────────────
// Platform-level: tickets aren't tied to a single property, so this skips
// resolveAppSettings/renderPropertyTemplateSendEmail (both property-scoped) and
// builds a plain inline HTML body instead, mirroring orgVerificationEmail.ts.

const SUPPORT_TICKET_CATEGORY_LABELS: Record<string, string> = {
  bug_report: 'Bug report',
  feature_suggestion: 'Feature suggestion',
  general_inquiry: 'General inquiry',
  business_inquiry: 'Business inquiry',
};

/** New ticket → notifies the support team inbox (SUPPORT_TEAM_EMAIL). */
export async function sendSupportTicketNotify(ticket: {
  organizationName: string;
  propertyName: string | null;
  parkingName: string | null;
  category: string;
  subject: string;
  submittedByName: string;
  submittedByEmail: string;
  bodyPreview: string;
}) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPPORT_TEAM_EMAIL = Deno.env.get('SUPPORT_TEAM_EMAIL');
  if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY environment variable');
  if (!SUPPORT_TEAM_EMAIL) throw new Error('Missing SUPPORT_TEAM_EMAIL environment variable');

  const scopeLabel = ticket.parkingName
    ? `Parking - ${ticket.parkingName}`
    : ticket.propertyName
      ? `Property - ${ticket.propertyName}`
      : ticket.organizationName === 'Explore guest'
        ? 'Explore (guest)'
        : 'Organization-level';
  const categoryLabel = SUPPORT_TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category;

  const bodyHtml = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">New support ticket from <strong>${escapeHtml(ticket.organizationName)}</strong> (${escapeHtml(scopeLabel)}).</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="data-table" style="width:100%;table-layout:fixed;border:1px solid #e2e8f0;border-radius:16px;border-collapse:separate;border-spacing:0;overflow:hidden;font-size:14px;margin:0 0 16px 0;">
<tr><td class="tbl-label" style="padding:12px 16px;background-color:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;width:32%;">Category</td><td class="tbl-value" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;color:#333333;">${escapeHtml(categoryLabel)}</td></tr>
<tr><td class="tbl-label" style="padding:12px 16px;background-color:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Subject</td><td class="tbl-value" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;color:#333333;">${escapeHtml(ticket.subject)}</td></tr>
<tr><td class="tbl-label" style="padding:12px 16px;background-color:#f8fafc;font-weight:600;color:#475569;">From</td><td class="tbl-value" style="padding:12px 16px;background-color:#ffffff;color:#333333;">${escapeHtml(ticket.submittedByName)} &lt;${escapeHtml(ticket.submittedByEmail)}&gt;</td></tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px 0;border-collapse:separate;border-spacing:0;"><tr><td style="padding:18px 20px;background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:16px;font-size:14px;line-height:1.55;color:#333333;white-space:pre-wrap;">${escapeHtml(ticket.bodyPreview)}</td></tr></table>`;

  const supportBrand = PLATFORM_BRAND_NAME || 'Support';
  const html = await renderBrandedEmailShell({
    brandName: ticket.organizationName || supportBrand,
    unitLabel: ticket.organizationName,
    emailTitle: 'New support ticket',
    bodyHtml,
    brandColor: null,
  });

  const sent = await sendResendEmail({
    from: `${supportBrand} <${(Deno.env.get('RESEND_FROM_EMAIL') ?? SUPPORT_TEAM_EMAIL).trim()}>`,
    to: [SUPPORT_TEAM_EMAIL],
    reply_to: ticket.submittedByEmail,
    subject: `[${categoryLabel}] ${ticket.subject}`,
    html,
    errorLabel: 'email',
  });

  return sent;
}

/** Admin reply on a ticket → notifies the submitter (host or explore guest). */
export async function sendSupportTicketReplyNotify(ticket: {
  id: string;
  channel: 'host' | 'guest';
  orgSlug: string | null;
  propertySlug?: string | null;
  parkingSlug?: string | null;
  subject: string;
  submittedByEmail: string;
}) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!RESEND_API_KEY || !fromEmail) {
    console.warn(
      '[sendSupportTicketReplyNotify] RESEND_API_KEY or RESEND_FROM_EMAIL missing - skip'
    );
    return;
  }

  if (await isEmailSuppressed(ticket.submittedByEmail)) {
    console.warn('[sendSupportTicketReplyNotify] Skipping - submitter email is suppressed');
    return;
  }

  const ticketUrl = buildSupportTicketThreadUrl({
    channel: ticket.channel,
    ticketId: ticket.id,
    orgSlug: ticket.orgSlug,
    propertySlug: ticket.propertySlug,
    parkingSlug: ticket.parkingSlug,
  });

  const bodyHtml = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">There's a new reply on your support ticket <strong>${escapeHtml(ticket.subject)}</strong>.</p>
${buildEmailCtaHtml('View the ticket', ticketUrl, null)}`;

  const supportBrand = PLATFORM_BRAND_NAME || 'Support';
  const html = await renderBrandedEmailShell({
    brandName: supportBrand,
    unitLabel: 'Help & Support',
    emailTitle: 'New reply on your ticket',
    bodyHtml,
    brandColor: null,
  });

  const sent = await sendResendEmail({
    from: `${supportBrand} <${fromEmail}>`,
    to: [ticket.submittedByEmail],
    subject: `Re: ${ticket.subject}`,
    html,
    errorLabel: 'email',
  });

  return sent;
}

/** Submitter follow-up reply → notifies the support team inbox. */
export async function sendSupportTicketSubmitterReplyNotify(ticket: {
  ticketId: string;
  subject: string;
  category: string;
  submittedByName: string;
  submittedByEmail: string;
  bodyPreview: string;
  organizationName: string;
  propertyName: string | null;
  parkingName: string | null;
}) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPPORT_TEAM_EMAIL = Deno.env.get('SUPPORT_TEAM_EMAIL');
  if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY environment variable');
  if (!SUPPORT_TEAM_EMAIL) throw new Error('Missing SUPPORT_TEAM_EMAIL environment variable');

  const scopeLabel = ticket.parkingName
    ? `Parking - ${ticket.parkingName}`
    : ticket.propertyName
      ? `Property - ${ticket.propertyName}`
      : ticket.organizationName === 'Explore guest'
        ? 'Explore (guest)'
        : 'Organization-level';
  const categoryLabel = SUPPORT_TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category;

  const bodyHtml = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">New reply on ticket <strong>${escapeHtml(ticket.subject)}</strong> from ${escapeHtml(ticket.submittedByName)} (${escapeHtml(scopeLabel)}).</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px 0;border-collapse:separate;border-spacing:0;"><tr><td style="padding:18px 20px;background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:16px;font-size:14px;line-height:1.55;color:#333333;white-space:pre-wrap;">${escapeHtml(ticket.bodyPreview)}</td></tr></table>`;

  const supportBrand = PLATFORM_BRAND_NAME || 'Support';
  const html = await renderBrandedEmailShell({
    brandName: supportBrand,
    unitLabel: 'Help & Support',
    emailTitle: 'Ticket reply',
    bodyHtml,
    brandColor: null,
  });

  const sent = await sendResendEmail({
    from: `${supportBrand} <${(Deno.env.get('RESEND_FROM_EMAIL') ?? SUPPORT_TEAM_EMAIL).trim()}>`,
    to: [SUPPORT_TEAM_EMAIL],
    reply_to: ticket.submittedByEmail,
    subject: `Re: [${categoryLabel}] ${ticket.subject}`,
    html,
    errorLabel: 'email',
  });

  return sent;
}

/** Status set to resolved or closed → notifies the submitter. */
export async function sendSupportTicketStatusNotify(ticket: {
  id: string;
  channel: 'host' | 'guest';
  orgSlug: string | null;
  propertySlug?: string | null;
  parkingSlug?: string | null;
  subject: string;
  status: 'resolved' | 'closed';
  submittedByEmail: string;
}) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!RESEND_API_KEY || !fromEmail) {
    console.warn('[sendSupportTicketStatusNotify] email env missing - skip');
    return;
  }

  if (await isEmailSuppressed(ticket.submittedByEmail)) {
    console.warn('[sendSupportTicketStatusNotify] Skipping - submitter email is suppressed');
    return;
  }

  const ticketUrl = buildSupportTicketThreadUrl({
    channel: ticket.channel,
    ticketId: ticket.id,
    orgSlug: ticket.orgSlug,
    propertySlug: ticket.propertySlug,
    parkingSlug: ticket.parkingSlug,
  });

  const statusLabel = ticket.status === 'resolved' ? 'resolved' : 'closed';
  const bodyHtml =
    ticket.status === 'resolved'
      ? `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Your support ticket <strong>${escapeHtml(ticket.subject)}</strong> was marked <strong>resolved</strong>. Reply in the thread if you still need help.</p>
${buildEmailCtaHtml('View the ticket', ticketUrl, null)}`
      : `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Your support ticket <strong>${escapeHtml(ticket.subject)}</strong> was <strong>closed</strong>. Reopen it from the thread if you need more help.</p>
${buildEmailCtaHtml('View the ticket', ticketUrl, null)}`;

  const supportBrand = PLATFORM_BRAND_NAME || 'Support';
  const html = await renderBrandedEmailShell({
    brandName: supportBrand,
    unitLabel: 'Help & Support',
    emailTitle: `Ticket ${statusLabel}`,
    bodyHtml,
    brandColor: null,
  });

  const sent = await sendResendEmail({
    from: `${supportBrand} <${fromEmail}>`,
    to: [ticket.submittedByEmail],
    subject: `[${statusLabel}] ${ticket.subject}`,
    html,
    errorLabel: 'email',
  });

  return sent;
}

// ─── Cancellation emails ─────────────────────────────────────────────────────

const CANCELLATION_REASON_LABELS: Record<string, string> = {
  change_of_plans: 'Change of plans',
  found_another_place: 'Found another place',
  travel_issue: 'Travel issue',
  emergency: 'Emergency',
  no_show: 'No-show',
  no_payment: 'No payment received',
  duplicate_or_test: 'Duplicate or test booking',
  host_unavailable: 'Host could not host the stay',
  other: 'Other',
};

function cancellationReasonLabel(code: string | null | undefined): string {
  return CANCELLATION_REASON_LABELS[String(code ?? '')] ?? 'Cancellation';
}

function cancellationPeso(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return `₱${n.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildCancellationDetailSectionHtml(input: {
  title: string;
  rows: Array<{ label: string; value: string }>;
  note?: string | null;
}): string {
  const rows = input.rows
    .map(
      (row) =>
        `<tr><td style="padding:6px 0;color:#666666;font-size:14px;">${escapeHtml(row.label)}</td><td style="padding:6px 0;color:#111111;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(row.value)}</td></tr>`
    )
    .join('');
  const note = input.note
    ? `<p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#333333;">${escapeHtml(input.note)}</p>`
    : '';
  return `<div style="margin:0 0 16px 0;border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
<p style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#111111;">${escapeHtml(input.title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>${note}</div>`;
}

export type CancellationEmailContext = {
  refundDuePhp: number;
  refundPercent: number | null;
  reasonCode: string;
  reasonNote?: string | null;
  initiator: 'guest' | 'host' | 'ota' | 'system';
  policyTitle?: string | null;
};

async function loadCancellationEmailContext(booking: GuestSubmission) {
  const propertyId = resolveEmailPropertyId(booking);
  const { EMAIL_REPLY_TO, settings } = await getResendCredentials(propertyId);
  const { branding, unitLabel, displayCheckInDate, displayCheckOutDate } =
    await loadBookingEmailDisplayContext(propertyId, booking);
  const guestContact = await loadGuestFacingContactInfo(propertyId, settings);
  const guestLinkExtras = await loadGuestBookingEmailLinkExtras(booking, settings);
  return {
    propertyId,
    EMAIL_REPLY_TO,
    settings,
    branding,
    unitLabel,
    displayCheckInDate,
    displayCheckOutDate,
    guestContact,
    guestLinkExtras,
  };
}

/** Guest: cancellation confirmed (instant guest cancel, host cancel, no-show). */
export async function sendBookingCancelledGuest(
  booking: GuestSubmission,
  ctx: CancellationEmailContext
) {
  if (!booking.guest_email?.trim()) return { skipped: true, reason: 'no_guest_email' };
  if (await isEmailSuppressed(booking.guest_email)) {
    return { skipped: true, reason: 'suppressed' };
  }

  const c = await loadCancellationEmailContext(booking);
  const guestName = String(booking.guest_facebook_name ?? '').trim() || 'Guest';
  const who = ctx.initiator === 'host' ? 'The host cancelled this booking.' : 'Your booking was cancelled.';

  const detail = buildCancellationDetailSectionHtml({
    title: 'Cancellation summary',
    rows: [
      { label: 'Stay', value: `${c.displayCheckInDate} to ${c.displayCheckOutDate}` },
      { label: 'Reason', value: cancellationReasonLabel(ctx.reasonCode) },
      ...(ctx.policyTitle ? [{ label: 'Policy', value: ctx.policyTitle }] : []),
      ...(ctx.refundPercent != null ? [{ label: 'Policy refund', value: `${ctx.refundPercent}% of paid` }] : []),
      { label: 'Refund', value: cancellationPeso(ctx.refundDuePhp) },
    ],
    note: ctx.reasonNote ?? null,
  });

  const html = await renderPropertyTemplateSendEmail({
    propertyId: c.propertyId,
    templateKey: 'email-booking-cancelled-guest',
    emailTitle: 'Booking cancelled',
    placeholderVars: buildBookingPlaceholderVars(
      booking,
      c.settings,
      {
        ...c.guestLinkExtras,
        ...buildGuestFacingPlaceholderVars(c.guestContact),
        cancellation_intro: who,
        cancellation_detail_section: detail,
        email_signature_section: buildEmailSignatureSectionHtml(c.settings.gafUnitOwner, c.unitLabel),
      },
      c.branding
    ),
    branding: c.branding,
  });

  return sendResendEmail({
    from: formatResendFromAddress(`${c.unitLabel} - ${c.branding.organizationName}`, c.branding.fromEmail),
    to: [booking.guest_email],
    reply_to: c.EMAIL_REPLY_TO,
    subject: `${c.unitLabel} - Booking Cancelled ${formatEmailDateRange(c.displayCheckInDate, c.displayCheckOutDate)}`,
    html,
    errorLabel: 'email',
  });
}

/** Host: a guest cancelled or asked to cancel. */
export async function sendBookingCancelledHost(
  booking: GuestSubmission,
  ctx: CancellationEmailContext & { requestOnly?: boolean }
) {
  const c = await loadCancellationEmailContext(booking);
  const to = String(c.EMAIL_REPLY_TO ?? '').trim();
  if (!to) return { skipped: true, reason: 'no_host_email' };
  if (await isEmailSuppressed(to)) return { skipped: true, reason: 'suppressed' };

  const guestName =
    String(booking.primary_guest_name ?? '').trim() ||
    String(booking.guest_facebook_name ?? '').trim() ||
    'A guest';

  const detail = buildCancellationDetailSectionHtml({
    title: ctx.requestOnly ? 'Cancellation request' : 'Cancellation summary',
    rows: [
      { label: 'Guest', value: guestName },
      { label: 'Stay', value: `${c.displayCheckInDate} to ${c.displayCheckOutDate}` },
      { label: 'Reason', value: cancellationReasonLabel(ctx.reasonCode) },
      ...(ctx.requestOnly
        ? []
        : [{ label: 'Refund to send', value: cancellationPeso(ctx.refundDuePhp) }]),
    ],
    note: ctx.reasonNote ?? null,
  });

  const html = await renderPropertyTemplateSendEmail({
    propertyId: c.propertyId,
    templateKey: 'email-booking-cancelled-host',
    emailTitle: ctx.requestOnly ? 'Cancellation requested' : 'Booking cancelled',
    placeholderVars: buildBookingPlaceholderVars(
      booking,
      c.settings,
      {
        ...c.guestLinkExtras,
        ...buildGuestFacingPlaceholderVars(c.guestContact),
        cancellation_detail_section: detail,
        email_signature_section: buildEmailSignatureSectionHtml(c.settings.gafUnitOwner, c.unitLabel),
      },
      c.branding
    ),
    branding: c.branding,
  });

  return sendResendEmail({
    from: formatResendFromAddress(`${c.unitLabel} - ${c.branding.organizationName}`, c.branding.fromEmail),
    to: [to],
    reply_to: c.EMAIL_REPLY_TO,
    subject: `${c.unitLabel} - ${ctx.requestOnly ? 'Cancellation requested' : 'Cancellation'} ${formatEmailDateRange(c.displayCheckInDate, c.displayCheckOutDate)}`,
    html,
    errorLabel: 'email',
  });
}

/** Guest: cancellation request received / approved / declined. */
export async function sendCancellationRequestGuest(
  booking: GuestSubmission,
  input: {
    state: 'received' | 'approved' | 'declined';
    hostMessage?: string | null;
    refundDuePhp?: number | null;
  }
) {
  if (!booking.guest_email?.trim()) return { skipped: true, reason: 'no_guest_email' };
  if (await isEmailSuppressed(booking.guest_email)) {
    return { skipped: true, reason: 'suppressed' };
  }

  const c = await loadCancellationEmailContext(booking);
  const guestName = String(booking.guest_facebook_name ?? '').trim() || 'Guest';
  const title =
    input.state === 'received'
      ? 'Cancellation request received'
      : input.state === 'approved'
        ? 'Cancellation approved'
        : 'Cancellation request declined';

  const detail = buildCancellationDetailSectionHtml({
    title,
    rows: [
      { label: 'Stay', value: `${c.displayCheckInDate} to ${c.displayCheckOutDate}` },
      ...(input.refundDuePhp != null
        ? [{ label: 'Refund', value: cancellationPeso(input.refundDuePhp) }]
        : []),
    ],
    note: input.hostMessage ?? null,
  });

  const html = await renderPropertyTemplateSendEmail({
    propertyId: c.propertyId,
    templateKey: 'email-cancellation-request-guest',
    emailTitle: title,
    placeholderVars: buildBookingPlaceholderVars(
      booking,
      c.settings,
      {
        ...c.guestLinkExtras,
        ...buildGuestFacingPlaceholderVars(c.guestContact),
        cancellation_request_title: title,
        cancellation_detail_section: detail,
        email_signature_section: buildEmailSignatureSectionHtml(c.settings.gafUnitOwner, c.unitLabel),
      },
      c.branding
    ),
    branding: c.branding,
  });

  return sendResendEmail({
    from: formatResendFromAddress(`${c.unitLabel} - ${c.branding.organizationName}`, c.branding.fromEmail),
    to: [booking.guest_email],
    reply_to: c.EMAIL_REPLY_TO,
    subject: `${c.unitLabel} - ${title}`,
    html,
    errorLabel: 'email',
  });
}

/** Guest: refund marked sent. */
export async function sendRefundSentGuest(
  booking: GuestSubmission,
  input: { amountPhp: number; proofUrl?: string | null }
) {
  if (!booking.guest_email?.trim()) return { skipped: true, reason: 'no_guest_email' };
  if (await isEmailSuppressed(booking.guest_email)) {
    return { skipped: true, reason: 'suppressed' };
  }

  const c = await loadCancellationEmailContext(booking);
  const detail = buildCancellationDetailSectionHtml({
    title: 'Refund sent',
    rows: [{ label: 'Amount', value: cancellationPeso(input.amountPhp) }],
    note: input.proofUrl ? 'A receipt is attached to your booking.' : null,
  });

  const html = await renderPropertyTemplateSendEmail({
    propertyId: c.propertyId,
    templateKey: 'email-refund-sent-guest',
    emailTitle: 'Refund sent',
    placeholderVars: buildBookingPlaceholderVars(
      booking,
      c.settings,
      {
        ...c.guestLinkExtras,
        ...buildGuestFacingPlaceholderVars(c.guestContact),
        cancellation_detail_section: detail,
        email_signature_section: buildEmailSignatureSectionHtml(c.settings.gafUnitOwner, c.unitLabel),
      },
      c.branding
    ),
    branding: c.branding,
  });

  return sendResendEmail({
    from: formatResendFromAddress(`${c.unitLabel} - ${c.branding.organizationName}`, c.branding.fromEmail),
    to: [booking.guest_email],
    reply_to: c.EMAIL_REPLY_TO,
    subject: `${c.unitLabel} - Refund sent`,
    html,
    errorLabel: 'email',
  });
}
