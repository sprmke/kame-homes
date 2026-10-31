/**
 * Dynamic email blocks referenced via {{placeholders}} in template body copy.
 * Preview uses sample HTML; sends use booking-specific HTML from emailService.
 */

import type { AppSettingsResolved } from './appSettings.ts';
import { buildSocialContactMentionsHtml, type GuestFacingContactInfo } from './guestContactInfo.ts';
import type { PropertyEmailBranding } from './propertyEmailBranding.ts';
import { formatPhilippineMobileDisplay } from './fieldValidation.ts';
import {
  normalizePaymentProvider,
  paymentAccountNumberLabel,
  paymentEmailCopy,
  paymentQrAltText,
} from './paymentProviders.ts';
import {
  buildParkingBroadcastCopyText,
  emailSocialLinkStyle,
  escapeHtml,
  resolveEmailPrimaryHex,
  withEmailShellStyleVars,
} from './renderEmailHtml.ts';
import type { GuestFormData, GuestSubmission } from './types.ts';
import { computeTotalGuestBalanceFromBooking } from './totalGuestBalance.ts';
import { countStayNights, formatDateForEmail, formatTimeForDisplay } from './utils.ts';
import { formatReceiptVerdictLabel } from './receiptValidationService.ts';

/** Placeholder keys for computed HTML blocks (not plain-text fields). */
export const EMAIL_DYNAMIC_SECTION_KEYS = [
  'urgent_notice',
  'update_notice',
  'pet_details_section',
  'pet_attachments_section',
  'parking_reply_callout_section',
  'email_signature_section',
  'booking_acknowledgement_flow_section',
  'ready_for_checkin_booking_summary_section',
  'ready_for_checkin_contact_section',
  'stay_guide_cta_section',
  'new_booking_detail_tables',
  'downpayment_receipt_ai_section',
  'booking_link_cta',
  'document_reminders_section',
  'payment_breakdown_section',
  'gcash_payment_section',
  'sd_refund_checklist_section',
  'sd_refund_details_section',
  /** @deprecated Combined checklist + details — use split placeholders. */
  'sd_refund_footer_section',
  'booking_vehicle_copy',
] as const;

export type EmailDynamicSectionKey = (typeof EMAIL_DYNAMIC_SECTION_KEYS)[number];

/** Which dynamic blocks each email template uses by default. */
export const DYNAMIC_SECTIONS_BY_TEMPLATE: Record<string, EmailDynamicSectionKey[]> = {
  'email-gaf-request': ['urgent_notice', 'update_notice', 'email_signature_section'],
  'email-pet-request': [
    'urgent_notice',
    'update_notice',
    'pet_details_section',
    'pet_attachments_section',
    'email_signature_section',
  ],
  'email-parking-request': [
    'urgent_notice',
    'update_notice',
    'booking_vehicle_copy',
    'parking_reply_callout_section',
    'email_signature_section',
  ],
  'email-new-booking-request': [
    'urgent_notice',
    'new_booking_detail_tables',
    'downpayment_receipt_ai_section',
    'booking_link_cta',
  ],
  'email-booking-acknowledgement': [
    'booking_acknowledgement_flow_section',
    'email_signature_section',
  ],
  'email-ready-for-checkin': [
    'ready_for_checkin_booking_summary_section',
    'payment_breakdown_section',
    'gcash_payment_section',
    'document_reminders_section',
    'ready_for_checkin_contact_section',
    'stay_guide_cta_section',
    'email_signature_section',
  ],
  'email-sd-refund-form-request': ['sd_refund_checklist_section', 'sd_refund_details_section'],
};

function notifyDetailTableStyle(): string {
  return [
    'width:100%;table-layout:fixed;border:1px solid #e2e8f0;border-radius:16px;',
    'border-collapse:separate;border-spacing:0;overflow:hidden;font-size:14px;',
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
    'margin:0 0 26px 0;',
  ].join('');
}

function notifyRow(label: string, valueHtml: string, withBottomBorder: boolean): string {
  const b = withBottomBorder ? 'border-bottom:1px solid #e2e8f0;' : '';
  return `<tr>
  <td class="tbl-label" style="padding:12px 16px;background-color:#f8fafc;${b}font-weight:600;color:#475569;vertical-align:top;width:38%;">${label}</td>
  <td class="tbl-value" style="padding:12px 16px;background-color:#ffffff;${b}color:#333333;line-height:1.55;vertical-align:top;">${valueHtml}</td>
</tr>`;
}

function notifySectionTitle(
  text: string,
  brandColor?: string | null,
  margin = 'margin:24px 0 10px 0'
): string {
  const color = resolveEmailPrimaryHex(brandColor);
  return `<p class="section-label" style="${margin};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${color};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">${text}</p>`;
}

function formatPeso(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBookingSourceLabel(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (/^airbnb$/i.test(s)) return 'Airbnb';
  if (/^facebook$/i.test(s)) return 'Facebook';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Facebook';
}

function yesNo(v: boolean): string {
  return v ? 'Yes ‼️' : 'No';
}

function receiptVerdictEmailBadgeHtml(verdict: string | null | undefined): string {
  const label = formatReceiptVerdictLabel(verdict);
  const v = String(verdict ?? '').toLowerCase();
  let bg = '#f3f4f6';
  let color = '#374151';
  if (v === 'valid' || v === 'likely_valid') {
    bg = '#dcfce7';
    color = '#166534';
  } else if (v === 'unclear' || v === 'skipped') {
    bg = '#fef9c3';
    color = '#854d0e';
  } else if (v === 'invalid') {
    bg = '#fee2e2';
    color = '#991b1b';
  }
  return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${bg};color:${color};">${escapeHtml(label)}</span>`;
}

export function buildDownpaymentReceiptAiSectionFromBooking(
  booking: GuestSubmission,
  brandColor?: string | null
): string {
  const verdict = (booking as Record<string, unknown>).dp_receipt_ai_verdict as
    string | null | undefined;
  const summary = String((booking as Record<string, unknown>).dp_receipt_ai_summary ?? '').trim();
  if (!verdict && !summary) return '';

  const tblStyle = notifyDetailTableStyle();
  const rows = [
    notifyRow('Verdict', receiptVerdictEmailBadgeHtml(verdict), true),
    notifyRow('Summary', escapeHtml(summary || 'N/A'), false),
  ].join('');

  return [
    notifySectionTitle('Downpayment receipt AI check', brandColor),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${tblStyle}">${rows}</table>`,
  ].join('\n');
}

export function buildBookingLinkCtaHtml(bookingLink: string, brandColor: string): string {
  if (!bookingLink.trim()) return '';
  const ctaStyle = withEmailShellStyleVars({}, brandColor).emailShellCtaBtnStyle;
  return `<div class="cta-wrap" style="margin:28px 0 8px 0;text-align:center;"><a class="cta-btn" style="${ctaStyle}" href="${escapeHtml(bookingLink)}" target="_blank" rel="noopener">View Booking Details</a></div>`;
}

/** Guest trip page button: booking status, documents, and host chat in one place. */
export function buildGuestTripCtaHtml(
  tripUrl: string | null | undefined,
  brandColor: string
): string {
  const url = tripUrl?.trim();
  if (!url) return '';
  const ctaStyle = withEmailShellStyleVars({}, brandColor).emailShellCtaBtnStyle;
  return `<div class="cta-wrap" style="margin:28px 0 8px 0;text-align:center;"><a class="cta-btn" style="${ctaStyle}" href="${escapeHtml(url)}" target="_blank" rel="noopener">View your booking</a></div>`;
}

export function buildStayGuideCtaHtml(stayGuideUrl: string, brandColor: string): string {
  if (!stayGuideUrl.trim()) return '';
  const ctaStyle = withEmailShellStyleVars({}, brandColor).emailShellCtaBtnStyle;
  return `${notifySectionTitle('Your stay guide', brandColor)}<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Everything for check-in through check-out — house rules, parking, and unit instructions — in one place on your phone.</p><div class="cta-wrap" style="margin:8px 0 24px 0;text-align:center;"><a class="cta-btn" style="${ctaStyle}" href="${escapeHtml(stayGuideUrl)}" target="_blank" rel="noopener">Open Stay Guide</a></div>`;
}

export function buildGafUpdateNoticeHtml(unitLabel: string): string {
  const body = `The Guest Advise Form (GAF) details for <strong>${escapeHtml(unitLabel)}</strong> have been updated. Please disregard the previous GAF request email for the same dates and unit.`;
  return buildUpdateNoticeCalloutHtml(body);
}

export function buildPetUpdateNoticeHtml(unitLabel: string): string {
  const body = `The pet information for our guest at <strong>${escapeHtml(unitLabel)}</strong> has been updated. Please disregard the previous pet request email for the same dates and unit.`;
  return buildUpdateNoticeCalloutHtml(body);
}

export function buildParkingUpdateNoticeHtml(unitLabel: string): string {
  const body = `The parking registration details for <strong>${escapeHtml(unitLabel)}</strong> have been updated. Please disregard the previous parking request email for the same dates and unit.`;
  return buildUpdateNoticeCalloutHtml(body);
}

/** Amber resubmit callout — matches legacy `.callout-warn` with inlined styles for Gmail. */
export function buildUpdateNoticeCalloutHtml(bodyHtml: string): string {
  const tdStyle =
    "background-color:#fff4e0;border:1px solid #d4a574;border-left-width:4px;border-left-color:#c4884a;border-radius:0 16px 16px 0;padding:18px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.55;color:#5c4428;";
  const titleStyle =
    "display:block;margin-bottom:6px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#7a5a32;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;";
  return `<table role="presentation" class="callout-outer callout-warn callout-update" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td style="${tdStyle}"><strong class="callout-title" style="${titleStyle}">Updated request</strong>${bodyHtml}</td></tr></table>`;
}

/** Same-day check-in (Asia/Manila) — HTML callout for ops + guest templates. */
export function buildUrgentSameDayCallout(isUrgent: boolean): string {
  if (!isUrgent) return '';
  const tdStyle =
    "background-color:#fde8e8;border:1px solid #e8a0a0;border-left-width:4px;border-left-color:#c94c4c;border-radius:0 16px 16px 0;padding:18px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.55;color:#6b2d2d;";
  const titleStyle =
    "display:block;margin-bottom:6px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#8b3a3a;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;";
  return `<table role="presentation" class="callout-outer callout-urgent" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td style="${tdStyle}"><strong class="callout-title" style="${titleStyle}">Urgent! Same-day check-in!</strong>This request requires immediate attention and approval.</td></tr></table>`;
}

/** Ops-facing templates with same-day urgent callout (preview shows sample). */
export const EMAIL_TEMPLATES_WITH_URGENT_CALLOUT = new Set([
  'email-gaf-request',
  'email-pet-request',
  'email-parking-request',
  'email-new-booking-request',
]);

/** Resubmit update notice — empty on first send. */
export const EMAIL_TEMPLATES_WITH_UPDATE_NOTICE = new Set([
  'email-gaf-request',
  'email-pet-request',
  'email-parking-request',
]);

export function sampleUpdateNoticeHtml(templateKey: string, unitLabel: string): string {
  if (templateKey === 'email-gaf-request') {
    return buildGafUpdateNoticeHtml(unitLabel);
  }
  if (templateKey === 'email-pet-request') {
    return buildPetUpdateNoticeHtml(unitLabel);
  }
  if (templateKey === 'email-parking-request') {
    return buildParkingUpdateNoticeHtml(unitLabel);
  }
  return '';
}

export function buildDateLineBlockHtml(
  checkIn: string,
  checkOut: string,
  brandColor: string
): string {
  const inDate = String(checkIn ?? '').trim();
  const outDate = String(checkOut ?? '').trim();
  if (!inDate || !outDate) return '';
  const styles = withEmailShellStyleVars({}, brandColor);
  return `<p class="date-line" style="${styles.emailShellDateLineStyle}">${escapeHtml(inDate)}<span class="text-arrow" style="${styles.emailShellTextArrowStyle}">&nbsp;→&nbsp;</span>${escapeHtml(outDate)}</p>`;
}

export function buildEmailSignatureSectionHtml(ownerName: string, unitLabel: string): string {
  const name = escapeHtml(ownerName.trim() || 'Unit Owner');
  const unit = escapeHtml(unitLabel);
  return `<table role="presentation" class="footer-divider" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;margin-top:24px;"><tr><td class="signature-pad" style="padding-top:28px;"><p class="signature-lead" style="margin:0 0 8px 0;font-size:15px;line-height:1.5;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Best regards,</p><p class="signature-body" style="margin:0;font-size:15px;line-height:1.55;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;"><strong style="font-weight:700;">${name}</strong><br/><span class="signature-role" style="font-size:14px;color:#555555;">Unit Owner, ${unit}</span></p></td></tr></table>`;
}

function petMetaRow(label: string, valueHtml: string, withBottomBorder: boolean): string {
  const b = withBottomBorder ? 'border-bottom:1px solid #e2e8f0;' : '';
  return `<tr><td width="38%" valign="top" class="tbl-label" style="padding:16px 20px;background-color:#f1f5f9;${b}color:#475569;font-weight:700;font-size:15px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">${label}</td><td valign="top" class="tbl-value" style="padding:16px 20px;background-color:#ffffff;${b}color:#333333;font-size:15px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">${valueHtml}</td></tr>`;
}

export function buildPetDetailsSectionHtml(input: {
  petName: string;
  petType: string;
  petBreed: string;
  petAge: string;
  petVaccinationDate: string;
  brandColor?: string | null;
}): string {
  const rows = [
    petMetaRow('Pet name', escapeHtml(input.petName), true),
    petMetaRow('Type', escapeHtml(input.petType), true),
    petMetaRow('Breed', escapeHtml(input.petBreed), true),
    petMetaRow('Age', escapeHtml(input.petAge), true),
    petMetaRow('Vaccination date', escapeHtml(input.petVaccinationDate), false),
  ].join('');
  return `${notifySectionTitle('Pet details', input.brandColor)}<table role="presentation" class="data-table pet-meta-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">${rows}</table>`;
}

export function buildPetDetailsSectionFromGuestForm(
  formData: GuestFormData,
  brandColor?: string | null
): string {
  return buildPetDetailsSectionHtml({
    petName: String(formData.petName ?? '').trim() || 'N/A',
    petType: String(formData.petType ?? '').trim() || 'N/A',
    petBreed: String(formData.petBreed ?? '').trim() || 'N/A',
    petAge: String(formData.petAge ?? '').trim() || 'N/A',
    petVaccinationDate:
      formatDateForEmail(String(formData.petVaccinationDate ?? '').trim()) || 'N/A',
    brandColor,
  });
}

export function buildPetAttachmentsSectionHtml(brandColor: string): string {
  const styles = withEmailShellStyleVars({}, brandColor);
  return `${notifySectionTitle('Attachments included', brandColor)}<table role="presentation" class="attach-list-wrap" width="100%" cellspacing="0" cellpadding="0" border="0" style="${styles.emailAttachListWrapStyle}"><tr><td class="attach-list-cell" style="${styles.emailAttachListCellStyle}">Completed pet form with required information<br/>Pet vaccination records<br/>Pet photograph</td></tr></table>`;
}

export function buildParkingReplyCalloutSectionHtml(): string {
  return `<table role="presentation" class="callout-outer-v callout-reply" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #dbe4ef;border-radius:16px;background-color:#f8fafc;margin:16px 0 0 0;"><tr><td width="100%" style="width:100%;max-width:100%;box-sizing:border-box;padding:18px 20px;background-color:#f8fafc;border-left:4px solid #3b82f6;border-radius:16px;color:#334155;font-size:15px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">If you have an available parking slot for those dates, please <strong>reply to this email with your lowest rate</strong>. Then, wait for our confirmation reply on whether we will proceed with your parking service. Thank you for your assistance.</td></tr></table>`;
}

function buildAcknowledgementStepCard(
  stepNum: number,
  bodyHtml: string,
  brandColor: string
): string {
  const s = withEmailShellStyleVars({}, brandColor);
  return `<table role="presentation" class="step-card-outer" width="100%" cellspacing="0" cellpadding="0" border="0" style="${s.emailStepCardOuterStyle}"><tr><td class="step-card-inner-wrap" style="${s.emailStepCardInnerWrapStyle}"><table role="presentation" class="step-card-inner" width="100%" cellspacing="0" cellpadding="0" border="0" style="${s.emailStepCardInnerStyle}"><tr><td class="step-num-cell" style="${s.emailStepNumCellStyle}"><span class="step-num" style="${s.emailStepNumTextStyle}">${stepNum}</span></td><td class="step-body-cell" style="${s.emailStepBodyCellStyle}"><p style="${s.emailStepBodyPStyle}">${bodyHtml}</p></td></tr></table></td></tr></table>`;
}

function stepRowGap(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr></table>`;
}

export function buildBookingAcknowledgementFlowSectionHtml(input: {
  unitLabel: string;
  checkIn: string;
  checkOut: string;
  brandColor: string;
  contact: GuestFacingContactInfo;
  /** Phase 7 — self-serve parking CTA, shown only when set (guest signaled need_parking). */
  parkingUrl?: string | null;
  /** Guest trip page (booking details, documents, chat). Button omitted when empty. */
  tripUrl?: string | null;
}): string {
  const unit = escapeHtml(input.unitLabel);
  const checkIn = escapeHtml(input.checkIn);
  const checkOut = escapeHtml(input.checkOut);
  const socialMentions = buildSocialContactMentionsHtml(input.contact, input.brandColor);
  const summary = `<table role="presentation" class="summary-surface" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;margin:0 0 4px 0;"><tr><td class="summary-inner" style="padding:18px 20px;"><p style="margin:0;font-size:16px;line-height:1.65;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Your booking request for <strong style="color:#111827;font-weight:700;">${unit} from ${checkIn} to ${checkOut}</strong> has been approved.</p></td></tr></table>`;
  const step1 = buildAcknowledgementStepCard(
    1,
    'We have forwarded your Guest Advise Form (GAF) to the building administration for approval.',
    input.brandColor
  );
  const step2 = buildAcknowledgementStepCard(
    2,
    `Approval typically takes a <strong style="color:#111827;font-weight:700;">few hours up to two (2) business days</strong>. If you haven't heard from us until your check-in date, please reply to this email or ${socialMentions} so we can follow up promptly.`,
    input.brandColor
  );
  const step3 = buildAcknowledgementStepCard(
    3,
    'Once your GAF is approved, we will send you a <strong>Booking Confirmation email</strong> with all the details you need for your arrival.',
    input.brandColor
  );
  const parkingCallout = buildParkingSelfServeCalloutHtml(input.parkingUrl);
  const tripCta = buildGuestTripCtaHtml(input.tripUrl, input.brandColor);
  return `${summary}${notifySectionTitle("What's next", input.brandColor)}${step1}${stepRowGap()}${step2}${stepRowGap()}${step3}${parkingCallout}${tripCta}`;
}

/**
 * Phase 7 — guest signaled parking interest on the form but pricing/reservation now happens
 * through the marketplace, not this email. Reuses the `.callout-parking` fragment CSS already
 * shipped in every property template (previously unused in any generated HTML).
 */
function buildParkingSelfServeCalloutHtml(parkingUrl: string | null | undefined): string {
  const url = parkingUrl?.trim();
  if (!url) return '';
  const tdStyle =
    "background-color:#fff4e0;border:1px solid #d4a574;border-left-width:4px;border-left-color:#c4884a;border-radius:0 16px 16px 0;padding:18px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.55;color:#5c4428;";
  const titleStyle =
    "display:block;margin-bottom:6px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#7a5a32;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;";
  const strongStyle = 'color:#5c4428;font-weight:700;';
  return `<table role="presentation" class="callout-outer callout-parking" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 0 0;width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td style="${tdStyle}"><strong class="callout-title" style="${titleStyle}">Need parking?</strong>You mentioned you'd like paid parking for your stay. Reserve and pay for a spot separately — <a href="${escapeHtml(url)}" class="callout-strong" style="${strongStyle}text-decoration:underline;">find parking near your stay</a>.</td></tr></table>`;
}

export function buildReadyForCheckinBookingSummarySectionHtml(input: {
  unitLabel: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  pax: number;
  brandColor?: string | null;
}): string {
  const tblStyle = notifyDetailTableStyle();
  const rows = [
    notifyRow('Unit', escapeHtml(input.unitLabel), true),
    notifyRow('Check-in', `${escapeHtml(input.checkIn)} at ${escapeHtml(input.checkInTime)}`, true),
    notifyRow(
      'Check-out',
      `${escapeHtml(input.checkOut)} at ${escapeHtml(input.checkOutTime)}`,
      true
    ),
    notifyRow('Guests', `${escapeHtml(String(input.pax))} pax`, false),
  ].join('');
  return `${notifySectionTitle('Booking summary', input.brandColor)}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${tblStyle}">${rows}</table>`;
}

export function buildReadyForCheckinBookingSummaryFromBooking(
  booking: GuestSubmission,
  branding: PropertyEmailBranding,
  brandColor?: string | null
): string {
  const unitLabel = branding.unitLabel;
  const pax = (booking.number_of_adults ?? 0) + (booking.number_of_children ?? 0);
  return buildReadyForCheckinBookingSummarySectionHtml({
    unitLabel,
    checkIn: formatDateForEmail(booking.check_in_date),
    checkOut: formatDateForEmail(booking.check_out_date),
    checkInTime: formatTimeForDisplay(booking.check_in_time, '2:00 PM'),
    checkOutTime: formatTimeForDisplay(booking.check_out_time, '11:00 AM'),
    pax,
    brandColor,
  });
}

export function buildReadyForCheckinContactSectionHtml(
  contact: GuestFacingContactInfo,
  brandColor?: string | null
): string {
  const socialMentions = buildSocialContactMentionsHtml(contact, brandColor);
  const phone = contact.contactPhone.trim();
  const email = contact.contactEmail.trim();
  const contactLines: string[] = [];
  if (phone) {
    contactLines.push(
      `For urgent matters, reach us at <strong style="color:#111827;font-weight:700;">${escapeHtml(formatPhilippineMobileDisplay(phone))}</strong>`
    );
  }
  const contactBlock = contactLines.length > 0 ? `<br/><br/>${contactLines.join('<br/>')}` : '';

  return `${notifySectionTitle('Contact us', brandColor)}<p class="contact-us-copy" style="margin:0 0 22px 0;font-size:15px;line-height:1.65;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">If you have any questions before your stay, ${socialMentions}.${contactBlock}<br/><br/>See you soon!</p>`;
}

export function buildNewBookingDetailTablesHtml(input: {
  checkIn: string;
  checkOut: string;
  nights: number;
  pax: number;
  guestFacebookName: string;
  primaryGuestName: string;
  address: string;
  phone: string;
  email: string;
  bookingSource: string;
  needParking: boolean;
  hasPets: boolean;
  hasDecor: boolean;
  brandColor?: string | null;
}): string {
  const tblStyle = notifyDetailTableStyle();
  const stayRows = [
    notifyRow('Check-in', escapeHtml(input.checkIn), true),
    notifyRow('Check-out', escapeHtml(input.checkOut), true),
    notifyRow('Number of nights', escapeHtml(String(input.nights)), true),
    notifyRow('Number of pax', escapeHtml(String(input.pax)), false),
  ].join('');
  const guestRows = [
    notifyRow('Facebook Name', escapeHtml(input.guestFacebookName), true),
    notifyRow('Primary Guest Name', escapeHtml(input.primaryGuestName), true),
    notifyRow('Address', escapeHtml(input.address), true),
    notifyRow('Phone Number', escapeHtml(input.phone), true),
    notifyRow('Email', escapeHtml(input.email), true),
    notifyRow('Source', escapeHtml(formatBookingSourceLabel(input.bookingSource)), false),
  ].join('');
  const notableRows = [
    notifyRow('Requires pay parking?', escapeHtml(yesNo(input.needParking)), true),
    notifyRow('Requires pet approval', escapeHtml(yesNo(input.hasPets)), true),
    notifyRow('Requires surprise setup / room decor?', escapeHtml(yesNo(input.hasDecor)), false),
  ].join('');

  return [
    notifySectionTitle('Stay details', input.brandColor),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${tblStyle}">${stayRows}</table>`,
    notifySectionTitle('Guest details', input.brandColor),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${tblStyle}">${guestRows}</table>`,
    notifySectionTitle('Notable information', input.brandColor),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${tblStyle}">${notableRows}</table>`,
  ].join('\n');
}

export function buildNewBookingDetailTablesFromBooking(
  booking: GuestSubmission,
  brandColor?: string | null
): string {
  const nn = booking.number_of_nights;
  const nights =
    nn != null && Number.isFinite(Number(nn)) && Number(nn) >= 0
      ? Number(nn)
      : countStayNights(booking.check_in_date, booking.check_out_date);
  const pax = (booking.number_of_adults ?? 0) + (booking.number_of_children ?? 0);
  return buildNewBookingDetailTablesHtml({
    checkIn: formatDateForEmail(booking.check_in_date),
    checkOut: formatDateForEmail(booking.check_out_date),
    nights,
    pax,
    guestFacebookName: String(booking.guest_facebook_name ?? ''),
    primaryGuestName: String(booking.primary_guest_name ?? ''),
    address: String(booking.guest_address ?? ''),
    phone: String(booking.guest_phone_number ?? ''),
    email: String(booking.guest_email ?? ''),
    bookingSource: String(booking.booking_source ?? ''),
    needParking: Boolean(booking.need_parking),
    hasPets: Boolean(booking.has_pets),
    hasDecor: Boolean(booking.guest_requests_surprise_decor),
    brandColor,
  });
}

export function buildDocumentRemindersSectionFromBooking(
  booking: GuestSubmission,
  brandColor: string
): string {
  const accent = resolveEmailPrimaryHex(brandColor);
  const docReminderCardStyle = `padding:18px 20px;background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${accent};border-radius:16px;color:#334155;font-size:14px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;`;

  const documentReminderBodies: string[] = [
    '<strong style="color:#1e293b;font-weight:700;">Guest Advise Form (GAF)</strong> — Your GAF has been approved. No need to print it! Simply present it at the guard house upon arrival and to the lobby receptionist during registration.',
  ];
  if (booking.need_parking) {
    documentReminderBodies.push(
      '<strong style="color:#1e293b;font-weight:700;">Parking</strong> — Your parking slot is confirmed. The guest parking fee is <strong style="color:#1e293b;font-weight:700;">non-refundable</strong>, and once confirmed your parking dates <strong style="color:#1e293b;font-weight:700;">cannot be rescheduled</strong>.'
    );
  }
  if (booking.has_pets) {
    documentReminderBodies.push(
      '<strong style="color:#1e293b;font-weight:700;">Pet</strong> — Your pet has been approved for this stay.'
    );
  }

  const documentReminderLis = documentReminderBodies
    .map((body, idx) => {
      const isLast = idx === documentReminderBodies.length - 1;
      const margin = isLast ? 'margin:0' : 'margin:0 0 12px 0';
      return `<li class="doc-reminders-card__li" style="${margin};padding:0;color:#334155;">${body}</li>`;
    })
    .join('');

  return `${notifySectionTitle('Attached documents', brandColor)}<table role="presentation" class="doc-reminders-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0;">
  <tr>
    <td class="doc-reminders-card__cell" style="${docReminderCardStyle}">
      <ul class="doc-reminders-card__list" style="margin:0;padding:0 0 0 20px;list-style-type:disc;">
        ${documentReminderLis}
      </ul>
    </td>
  </tr>
</table>`;
}

function sampleDocumentRemindersSection(brandColor: string): string {
  return buildDocumentRemindersSectionFromBooking(
    {
      need_parking: true,
      has_pets: false,
    } as GuestSubmission,
    brandColor
  );
}

function paymentBreakdownTableStyle(): string {
  return [
    'width:100%;table-layout:fixed;border:1px solid #e2e8f0;border-radius:16px;',
    'border-collapse:separate;border-spacing:0;overflow:hidden;font-size:14px;',
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  ].join('');
}

export function buildPaymentBreakdownSectionFromBooking(
  booking: GuestSubmission,
  pesoFormat: (amount: number | null | undefined) => string,
  totalDueAtCheckin: number,
  brandColor?: string | null
): string {
  const balance = booking.balance ?? (booking.booking_rate ?? 0) - (booking.down_payment ?? 0);
  const additionalGuestFee = Number(booking.guest_additional_fee ?? 0) || 0;

  const parkingPaymentRow = booking.need_parking
    ? `<tr class="fee-addon-row"><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Guest parking fee</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.parking_rate_guest as number | null)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"><em class="italic-note">Non-refundable; no rescheduling</em></td></tr>`
    : '';

  const petPaymentRow = booking.has_pets
    ? `<tr class="fee-addon-row"><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Pet fee</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.pet_fee as number | null)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"></td></tr>`
    : '';

  const additionalFeeRow =
    additionalGuestFee > 0
      ? `<tr class="fee-addon-row"><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Additional fee</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(additionalGuestFee)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;">Early check-in, late check-out, surprise decor, etc.</td></tr>`
      : '';

  const totalBalanceDue = pesoFormat(totalDueAtCheckin);

  return `${notifySectionTitle('Payment breakdown', brandColor)}<table role="presentation" class="data-table data-table-payment" width="100%" cellspacing="0" cellpadding="0" border="0" style="${paymentBreakdownTableStyle()}">
  <colgroup><col width="28%"/><col width="22%"/><col width="50%"/></colgroup>
  <tr><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Booking rate</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.booking_rate as number | null)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"></td></tr>
  <tr><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Down payment paid</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.down_payment as number | null)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"></td></tr>
  <tr><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Booking rate balance</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(balance as number)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"></td></tr>
  <tr><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Security deposit</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.security_deposit as number | null)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"><em class="italic-note">Refundable after check-out</em></td></tr>
  ${parkingPaymentRow}${petPaymentRow}${additionalFeeRow}
  <tr class="tbl-row-emphasis fee-addon-row"><td class="tbl-label" style="padding:12px 16px;background-color:#fffbeb;border-bottom:none;font-weight:600;color:#78350f;vertical-align:top;">Total balance</td><td class="tbl-num" style="padding:12px 16px;background-color:#fffbeb;border-bottom:none;text-align:right;color:#b45309;font-weight:700;vertical-align:top;">${totalBalanceDue}</td><td class="tbl-note" style="padding:12px 16px;background-color:#fffbeb;border-bottom:none;font-size:12px;color:#92400e;line-height:1.45;vertical-align:top;"><em class="italic-note">Payable on or before check-in. Please pay via online or bank transfer.</em></td></tr>
</table>`;
}

function samplePaymentBreakdownSection(brandColor?: string | null): string {
  return buildPaymentBreakdownSectionFromBooking(
    {
      booking_rate: 8500,
      down_payment: 2500,
      balance: 6000,
      security_deposit: 3000,
      need_parking: true,
      parking_rate_guest: 200,
      has_pets: false,
      guest_additional_fee: 0,
    } as GuestSubmission,
    formatPeso,
    9200,
    brandColor
  );
}

export function buildGcashPaymentSectionHtml(
  settings: AppSettingsResolved,
  paymentQrImageUrlByMethodId: Record<string, string> = {}
): string {
  const methods =
    settings.paymentMethods?.length > 0
      ? [
          ...settings.paymentMethods.filter((m) => m.isPrimary),
          ...settings.paymentMethods.filter((m) => !m.isPrimary),
        ]
      : [
          {
            id: 'legacy',
            provider: settings.paymentProvider,
            accountName: settings.gcashName,
            accountNumber: settings.gcashNumber,
            qrImageUrl: settings.gcashQrImageUrl || null,
            isPrimary: true,
          },
        ];

  const blocks = methods.map((method) => {
    const paymentProvider = normalizePaymentProvider(method.provider);
    const accountNumberLabel = paymentAccountNumberLabel(paymentProvider);
    const rawQr =
      paymentQrImageUrlByMethodId[method.id] ||
      (method.qrImageUrl && !method.qrImageUrl.includes('kame-home-gcash-qr-payment')
        ? method.qrImageUrl
        : '');
    const hasQr = Boolean(rawQr);
    const paymentCopy = paymentEmailCopy(paymentProvider, hasQr);
    const qrAlt = escapeHtml(paymentQrAltText(paymentProvider));
    const titleSuffix = methods.length > 1 ? ` — ${escapeHtml(paymentProvider)}` : '';
    const accountCell = `<td align="left" valign="middle" style="padding:0;vertical-align:middle">
          <p class="gcash-payment-label">Account name</p>
          <p class="gcash-payment-value gcash-payment-value-spaced">${escapeHtml(method.accountName)}</p>
          <p class="gcash-payment-label">${escapeHtml(accountNumberLabel)}</p>
          <p class="gcash-payment-value">${escapeHtml(method.accountNumber)}</p>
        </td>`;
    const row = hasQr
      ? `<tr>
        <td align="left" valign="top" style="padding:0 16px 0 0;width:250px;vertical-align:top;"><img src="${escapeHtml(rawQr)}" width="250" alt="${qrAlt}" style="display:block;width:100%;max-width:250px;height:auto;border:1px solid #e2e8f0;border-radius:12px;"/></td>
        ${accountCell}
      </tr>`
      : `<tr>${accountCell}</tr>`;

    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin:22px 0 0 0;">
  <tr><td style="padding:0;vertical-align:top">
    ${notifySectionTitle(
      `Total balance payment${titleSuffix}`,
      settings.brandColor,
      'margin:0 0 8px 0'
    )}
    <p class="gcash-payment-copy">${escapeHtml(paymentCopy)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">
      ${row}
    </table>
  </td></tr>
</table>`;
  });

  return blocks.join('');
}

function sampleGcashPaymentSection(settings: AppSettingsResolved): string {
  const methods = settings.paymentMethods?.length
    ? settings.paymentMethods
    : [
        {
          id: 'sample',
          provider: settings.paymentProvider,
          accountName: settings.gcashName || 'Sample Account',
          accountNumber: settings.gcashNumber || '09XX XXX XXXX',
          qrImageUrl: null,
          isPrimary: true,
        },
      ];
  const qrById: Record<string, string> = {};
  for (const m of methods) {
    if (m.qrImageUrl && !m.qrImageUrl.includes('kame-home-gcash-qr-payment')) {
      qrById[m.id] = escapeHtml(m.qrImageUrl);
    }
  }
  return buildGcashPaymentSectionHtml({ ...settings, paymentMethods: methods }, qrById);
}

/** Total guest balance due at check-in (same formula as sendReadyForCheckin). */
export function computeReadyForCheckinTotalDue(booking: GuestSubmission): number {
  const balance = booking.balance ?? (booking.booking_rate ?? 0) - (booking.down_payment ?? 0);
  const balanceNum = Number(balance);
  return (
    computeTotalGuestBalanceFromBooking(booking as unknown as Record<string, unknown>) ??
    (Number.isFinite(balanceNum) ? balanceNum : 0) +
      (Number(booking.security_deposit ?? 0) || 0) +
      (booking.has_pets ? Number(booking.pet_fee ?? 0) || 0 : 0) +
      (Number(booking.guest_additional_fee ?? 0) || 0)
  );
}

function sampleDownpaymentAiSection(brandColor?: string | null): string {
  const tblStyle = notifyDetailTableStyle();
  return [
    notifySectionTitle('Downpayment receipt AI check', brandColor),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${tblStyle}">
      ${notifyRow('Verdict', `<span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#dcfce7;color:#166534;">Likely valid</span>`, true)}
      ${notifyRow('Summary', 'Receipt matches expected payee and amount.', false)}
    </table>`,
  ].join('\n');
}

function sdRefundChecklistRow(label: string, valueHtml: string, last = false): string {
  const border = last ? '' : 'border-bottom:1px solid #e2e8f0;';
  return `<tr>
  <td style="padding:12px 16px;background-color:#f8fafc;${border}font-weight:600;color:#475569;vertical-align:top;width:31%;">${label}</td>
  <td style="padding:12px 16px;background-color:#ffffff;${border}color:#333333;line-height:1.55;vertical-align:top;">${valueHtml}</td>
</tr>`;
}

export function buildSdRefundChecklistSectionHtml(input: {
  unitLabel: string;
  brandColor?: string | null;
}): string {
  const unit = escapeHtml(input.unitLabel);
  const tblStyle = notifyDetailTableStyle();
  const checklistRows = [
    sdRefundChecklistRow(
      '1. Check-out time',
      'Check-out time is strictly on or before <strong style="color:#111827;font-weight:700;">11:00 AM</strong>.',
      false
    ),
    sdRefundChecklistRow(
      '2. Trash &amp; dishes',
      'Before leaving, please ensure all trash is properly bagged and no unwashed dishes are left behind.',
      false
    ),
    sdRefundChecklistRow(
      '3. Lights &amp; appliances',
      'Turn off all lights, air conditioning, and appliances, except for the refrigerator.',
      false
    ),
    sdRefundChecklistRow(
      '4. Belongings',
      'Double-check your belongings to make sure nothing is left behind.',
      false
    ),
    sdRefundChecklistRow(
      '5. Elevator card',
      `Return the Elevator Access Card to the mailbox indicated for <strong style="color:#111827;font-weight:700;">${unit}</strong> (ask lobby reception if you are unsure) and send us a photo as proof.`,
      false
    ),
    sdRefundChecklistRow(
      '6. Visitor&#8217;s pass',
      'Kindly surrender the Visitor&#8217;s Pass to the receptionist at the lobby.',
      false
    ),
    sdRefundChecklistRow(
      '7. Unit inspection',
      'Let us know once you have completed all the steps above so our staff can proceed with the unit inspection.',
      false
    ),
    sdRefundChecklistRow(
      '8. SD Refund',
      'If everything is in order (no damages or missing items), your security deposit refund will be processed within <strong style="color:#111827;font-weight:700;">1&#8211;2 hours</strong> after you submit <strong style="color:#111827;font-weight:700;">the SD refund form below</strong>.',
      true
    ),
  ].join('');

  return [
    notifySectionTitle('Check-out checklist', input.brandColor),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${tblStyle}">${checklistRows}</table>`,
  ].join('\n');
}

export function buildSdRefundDetailsSectionHtml(input: {
  securityDepositFormatted: string;
  sdFormUrl: string;
  brandColor: string;
}): string {
  const ctaStyle = withEmailShellStyleVars({}, input.brandColor).emailShellCtaBtnStyle;

  return [
    notifySectionTitle('SD Refund details', input.brandColor),
    `<p style="margin:0 0 22px 0;color:#333333;font-size:16px;line-height:1.65;">After check-out, please fill out the SD refund form below so that we can process your security deposit refund amounting to <strong style="color:#111827;font-weight:700;">${escapeHtml(input.securityDepositFormatted)}</strong>. Thank you.</p>`,
    `<div class="cta-wrap" style="margin:28px 0 8px 0;text-align:center;"><a class="cta-btn" style="${ctaStyle}" href="${escapeHtml(input.sdFormUrl)}" target="_blank" rel="noopener">Fill out Refund Form</a></div>`,
  ].join('\n');
}

/** @deprecated Use `buildSdRefundChecklistSectionHtml` + `buildSdRefundDetailsSectionHtml`. */
export function buildSdRefundFooterSectionHtml(input: {
  unitLabel: string;
  securityDepositFormatted: string;
  sdFormUrl: string;
  brandColor: string;
}): string {
  return [
    buildSdRefundChecklistSectionHtml({
      unitLabel: input.unitLabel,
      brandColor: input.brandColor,
    }),
    buildSdRefundDetailsSectionHtml({
      securityDepositFormatted: input.securityDepositFormatted,
      sdFormUrl: input.sdFormUrl,
      brandColor: input.brandColor,
    }),
  ].join('\n');
}

/** Selectable parking copy block — matches legacy `parking-broadcast.html` styling. */
export function buildBookingVehicleCopySectionHtml(input: {
  unitLabel: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  carBrandModel: string;
  carColor: string;
  carPlate: string;
  brandColor?: string | null;
}): string {
  const accent = resolveEmailPrimaryHex(input.brandColor);
  const copyText = escapeHtml(
    buildParkingBroadcastCopyText({
      unit: input.unitLabel,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      guestName: input.guestName,
      carBrandModel: input.carBrandModel,
      carColor: input.carColor,
      carPlate: input.carPlate,
    })
  );
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:100%;margin:16px 0 8px 0;"><tr><td style="padding:16px 18px;text-align:left;background-color:#f8fafc;border:2px solid #e2e8f0;border-left:4px solid ${accent};border-radius:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Courier New',monospace;font-size:14px;line-height:1.65;color:#334155;white-space:pre-wrap;word-break:break-word;">${copyText}</td></tr></table>`;
}

/** Sample dynamic sections for template preview (matches send layout). */
export function buildSampleDynamicSections(input: {
  templateKey: string;
  settings: AppSettingsResolved;
  branding: PropertyEmailBranding;
  guestContact?: GuestFacingContactInfo;
}): Record<string, string> {
  const keys = DYNAMIC_SECTIONS_BY_TEMPLATE[input.templateKey] ?? [];
  const out: Record<string, string> = {};
  const brandColor = input.settings.brandColor;
  const unit = escapeHtml(input.branding.unitLabel);
  const bookingLink = `${input.settings.publicGuestAppOrigin.replace(/\/+$/, '')}/bookings/00000000-0000-4000-8000-000000000001`;
  const sampleContact: GuestFacingContactInfo = input.guestContact ?? {
    facebookPageUrl: input.settings.facebookReviewsUrl || 'https://www.facebook.com/example',
    airbnbUrl: input.settings.airbnbUrl || 'https://www.airbnb.com/rooms/example',
    contactPhone: '09171234567',
    contactName: 'Jane Host',
    contactEmail: 'host@example.com',
  };

  for (const key of keys) {
    switch (key) {
      case 'urgent_notice':
        out.urgent_notice = buildUrgentSameDayCallout(true);
        break;
      case 'update_notice':
        out.update_notice = sampleUpdateNoticeHtml(input.templateKey, input.branding.unitLabel);
        break;
      case 'new_booking_detail_tables':
        out.new_booking_detail_tables = buildNewBookingDetailTablesHtml({
          checkIn: 'July 10, 2026',
          checkOut: 'July 12, 2026',
          nights: 2,
          pax: 2,
          guestFacebookName: 'Jane Guest',
          primaryGuestName: 'Jane Guest',
          address: '123 Sample St, Manila',
          phone: '09171234567',
          email: 'jane.guest@example.com',
          bookingSource: 'Facebook',
          needParking: true,
          hasPets: false,
          hasDecor: false,
          brandColor,
        });
        break;
      case 'downpayment_receipt_ai_section':
        out.downpayment_receipt_ai_section = sampleDownpaymentAiSection(brandColor);
        break;
      case 'booking_link_cta':
        out.booking_link_cta = buildBookingLinkCtaHtml(bookingLink, brandColor);
        break;
      case 'document_reminders_section':
        out.document_reminders_section = sampleDocumentRemindersSection(brandColor);
        break;
      case 'payment_breakdown_section':
        out.payment_breakdown_section = samplePaymentBreakdownSection(brandColor);
        break;
      case 'gcash_payment_section':
        out.gcash_payment_section = sampleGcashPaymentSection(input.settings);
        break;
      case 'sd_refund_checklist_section':
        out.sd_refund_checklist_section = buildSdRefundChecklistSectionHtml({
          unitLabel: input.branding.unitLabel,
          brandColor,
        });
        break;
      case 'sd_refund_details_section':
        out.sd_refund_details_section = buildSdRefundDetailsSectionHtml({
          securityDepositFormatted: '₱3,000.00',
          sdFormUrl: `${input.settings.publicGuestAppOrigin.replace(/\/+$/, '')}/properties/sample-property/sd-form?bookingId=sample`,
          brandColor,
        });
        break;
      case 'sd_refund_footer_section':
        out.sd_refund_footer_section = buildSdRefundFooterSectionHtml({
          unitLabel: input.branding.unitLabel,
          securityDepositFormatted: '₱3,000.00',
          sdFormUrl: `${input.settings.publicGuestAppOrigin.replace(/\/+$/, '')}/properties/sample-property/sd-form?bookingId=sample`,
          brandColor,
        });
        break;
      case 'booking_vehicle_copy':
        out.booking_vehicle_copy = buildBookingVehicleCopySectionHtml({
          unitLabel: input.branding.unitLabel,
          checkInDate: 'July 10, 2026',
          checkOutDate: 'July 12, 2026',
          guestName: 'Jane Guest',
          carBrandModel: 'Toyota Vios',
          carColor: 'White',
          carPlate: 'ABC 1234',
          brandColor,
        });
        break;
      case 'pet_details_section':
        out.pet_details_section = buildPetDetailsSectionHtml({
          petName: 'Buddy',
          petType: 'Dog',
          petBreed: 'Shih Tzu',
          petAge: '3 years old',
          petVaccinationDate: 'June 29, 2026',
          brandColor,
        });
        break;
      case 'pet_attachments_section':
        out.pet_attachments_section = buildPetAttachmentsSectionHtml(brandColor);
        break;
      case 'parking_reply_callout_section':
        out.parking_reply_callout_section = buildParkingReplyCalloutSectionHtml();
        break;
      case 'email_signature_section':
        out.email_signature_section = buildEmailSignatureSectionHtml(
          input.settings.gafUnitOwner,
          input.branding.unitLabel
        );
        break;
      case 'booking_acknowledgement_flow_section':
        out.booking_acknowledgement_flow_section = buildBookingAcknowledgementFlowSectionHtml({
          unitLabel: input.branding.unitLabel,
          checkIn: 'July 10, 2026',
          checkOut: 'July 12, 2026',
          brandColor,
          contact: sampleContact,
          // Phase 7 — sample-only so template editors can see the parking callout's layout;
          // the real send only includes it when the booking actually signaled need_parking.
          parkingUrl: 'https://example.com/parkings',
          tripUrl: `${input.settings.publicGuestAppOrigin}/properties/sample-unit/trip?bookingId=sample`,
        });
        break;
      case 'ready_for_checkin_booking_summary_section':
        out.ready_for_checkin_booking_summary_section =
          buildReadyForCheckinBookingSummarySectionHtml({
            unitLabel: input.branding.unitLabel,
            checkIn: 'July 10, 2026',
            checkOut: 'July 12, 2026',
            checkInTime: '2:00 PM',
            checkOutTime: '11:00 AM',
            pax: 2,
            brandColor,
          });
        break;
      case 'ready_for_checkin_contact_section':
        out.ready_for_checkin_contact_section = buildReadyForCheckinContactSectionHtml(
          sampleContact,
          brandColor
        );
        break;
      case 'stay_guide_cta_section':
        out.stay_guide_cta_section = buildStayGuideCtaHtml(
          `${input.settings.publicGuestAppOrigin}/properties/sample-unit/stay-guide?token=sample`,
          brandColor
        );
        break;
    }
  }

  return out;
}
