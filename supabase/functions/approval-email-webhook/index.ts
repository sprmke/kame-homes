/**
 * approval-email-webhook — Resend inbound `email.received` for Azure GAF/pet approvals.
 *
 * Public POST (verify_jwt=false). Auth = Svix signature (`RESEND_INBOUND_WEBHOOK_SECRET`).
 * Property routing = plus-address `approvals+{slug}@{RESEND_APPROVAL_INBOUND_DOMAIN}`.
 */

import { createClient } from '../_shared/supabaseJs.ts';
import {
  APPROVAL_INTAKE_DEV_CONTROLS,
  findApprovedAttachmentFilename,
  findBookingForApproval,
  isSenderAllowed,
  matchAttachment,
  parseApprovalSubject,
  type ApprovalKind,
} from '../_shared/approvalEmailMatcher.ts';
import {
  firstInboundRecipient,
  propertySlugFromInboundAddress,
} from '../_shared/approvalInboundAddress.ts';
import { bookingAssetStorageKey } from '../_shared/bookingStoragePaths.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { jsonError } from '../_shared/httpResponse.ts';
import { createNotification } from '../_shared/notificationService.ts';
import { bookingNotificationMetadata } from '../_shared/notificationEnrichment.ts';
import { resolveOrganizationIdForProperty } from '../_shared/propertyScope.ts';
import { verifyResendWebhookSignature } from '../_shared/resendWebhookVerify.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { formatPublicUrl } from '../_shared/utils.ts';
import { WorkflowOrchestrator } from '../_shared/workflowOrchestrator.ts';
import { buildActorContext } from '../_shared/activityLog.ts';

type ResendReceivedEvent = {
  type?: string;
  data?: {
    email_id?: string;
    message_id?: string;
    from?: string;
    to?: string[];
    received_for?: string[];
    subject?: string;
    attachments?: Array<{ id?: string; filename?: string; content_type?: string }>;
  };
};

type ResendAttachmentMeta = {
  id: string;
  filename: string;
  download_url?: string;
  content_type?: string;
};

function resendApiKey(): string {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  if (!apiKey) throw new Error('Missing RESEND_API_KEY');
  return apiKey;
}

function resendAuthFailureMessage(status: number, apiMessage?: string): string {
  if (status === 401) {
    return (
      apiMessage ??
      'Resend attachments API returned 401 — use a Full access API key (Sending-only keys cannot read inbound attachments)'
    );
  }
  return apiMessage ?? `Resend attachments request failed (${status})`;
}

async function getReceivingAttachment(
  emailId: string,
  attachmentId: string
): Promise<ResendAttachmentMeta> {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: { Authorization: `Bearer ${resendApiKey()}` } }
  );
  const json = (await res.json()) as ResendAttachmentMeta & {
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(resendAuthFailureMessage(res.status, json.error?.message));
  }
  return {
    id: json.id,
    filename: json.filename,
    download_url: json.download_url,
    content_type: json.content_type,
  };
}

async function listReceivingAttachments(emailId: string): Promise<ResendAttachmentMeta[]> {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments`,
    { headers: { Authorization: `Bearer ${resendApiKey()}` } }
  );
  const json = (await res.json()) as {
    data?: ResendAttachmentMeta[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(resendAuthFailureMessage(res.status, json.error?.message));
  }
  return json.data ?? [];
}

/** Prefer webhook attachment ids (download_url only comes from the Attachments API). */
async function resolveReceivingAttachments(
  emailId: string,
  webhookAttachments: Array<{ id?: string; filename?: string; content_type?: string }> | undefined
): Promise<ResendAttachmentMeta[]> {
  const ids = (webhookAttachments ?? []).map((a) => String(a.id ?? '').trim()).filter(Boolean);
  if (ids.length > 0) {
    const resolved: ResendAttachmentMeta[] = [];
    for (const id of ids) {
      const meta = await getReceivingAttachment(emailId, id);
      const webhook = webhookAttachments?.find((a) => a.id === id);
      resolved.push({
        ...meta,
        filename: meta.filename || String(webhook?.filename ?? ''),
        content_type: meta.content_type || webhook?.content_type,
      });
    }
    return resolved;
  }
  return listReceivingAttachments(emailId);
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

async function isAlreadyProcessed(messageId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('processed_emails')
    .select('message_id')
    .eq('message_id', messageId)
    .maybeSingle();
  return !!data;
}

async function recordProcessedEmail(params: {
  messageId: string;
  kind: ApprovalKind;
  status: 'applied' | 'skipped' | 'failed';
  reason?: string;
  bookingId?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('processed_emails')
    .upsert(
      {
        message_id: params.messageId,
        kind: params.kind,
        status: params.status,
        reason: params.reason ?? null,
        booking_id: params.bookingId ?? null,
      },
      { onConflict: 'message_id' }
    );
  if (error) {
    console.error('[approval-email-webhook] Failed to record processed email:', error.message);
  }
}

async function resolvePropertyIdBySlug(slug: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('properties')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('[approval-email-webhook] property slug lookup:', error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

async function downloadAttachmentBytes(downloadUrl: string): Promise<Uint8Array> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Attachment download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

async function uploadApprovedPdf(params: {
  kind: ApprovalKind;
  propertyId: string;
  bookingId: string;
  bytes: Uint8Array;
}): Promise<string> {
  const sb = supabaseAdmin();
  const bucket = params.kind === 'gaf' ? 'approved-gafs' : 'approved-pet-forms';
  const fileName = params.kind === 'gaf' ? 'approved-gaf.pdf' : 'approved-pet.pdf';
  const filename = bookingAssetStorageKey(params.propertyId, params.bookingId, fileName);

  const { error } = await sb.storage.from(bucket).upload(filename, params.bytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = sb.storage.from(bucket).getPublicUrl(filename);
  const raw = data?.publicUrl ?? filename;
  return raw.startsWith('http') ? formatPublicUrl(raw) : raw;
}

async function processReceivedEmail(event: ResendReceivedEvent): Promise<{
  action: 'applied' | 'skipped' | 'ignored';
  reason?: string;
  bookingId?: string;
  kind?: ApprovalKind;
}> {
  const data = event.data;
  if (!data?.email_id) {
    return { action: 'ignored', reason: 'missing_email_id' };
  }

  const dedupeId = data.email_id;
  if (await isAlreadyProcessed(dedupeId)) {
    return { action: 'skipped', reason: 'already_processed', kind: 'gaf' };
  }

  const recipient = firstInboundRecipient(data.to, data.received_for);
  if (!recipient) {
    await recordProcessedEmail({
      messageId: dedupeId,
      kind: 'gaf',
      status: 'skipped',
      reason: 'missing_recipient',
    });
    return { action: 'skipped', reason: 'missing_recipient', kind: 'gaf' };
  }

  const slug = propertySlugFromInboundAddress(recipient);
  if (!slug) {
    await recordProcessedEmail({
      messageId: dedupeId,
      kind: 'gaf',
      status: 'skipped',
      reason: `inbound_address_no_slug:${recipient}`,
    });
    return { action: 'skipped', reason: 'inbound_address_no_slug', kind: 'gaf' };
  }

  const propertyId = await resolvePropertyIdBySlug(slug);
  if (!propertyId) {
    await recordProcessedEmail({
      messageId: dedupeId,
      kind: 'gaf',
      status: 'skipped',
      reason: `unknown_property_slug:${slug}`,
    });
    return { action: 'skipped', reason: 'unknown_property_slug', kind: 'gaf' };
  }

  const subject = String(data.subject ?? '');
  const parsed = parseApprovalSubject(subject);
  if (!parsed) {
    await recordProcessedEmail({
      messageId: dedupeId,
      kind: 'gaf',
      status: 'skipped',
      reason: 'subject_no_match',
    });
    return { action: 'skipped', reason: 'subject_no_match', kind: 'gaf' };
  }

  const fromHeader = String(data.from ?? '');
  if (!(await isSenderAllowed(propertyId, fromHeader))) {
    await recordProcessedEmail({
      messageId: dedupeId,
      kind: parsed.kind,
      status: 'skipped',
      reason: `sender_not_allowed:${fromHeader}`,
    });
    return { action: 'skipped', reason: 'sender_not_allowed', kind: parsed.kind };
  }

  const attachments = await resolveReceivingAttachments(data.email_id, data.attachments);
  const filenames = attachments.map((a) => a.filename).filter(Boolean);
  const matchedName = findApprovedAttachmentFilename(parsed.kind, filenames);
  if (!matchedName) {
    // Prefer attachment-kind when subject kind attachment missing but another approved PDF present
    const anyKind = filenames.map((f) => matchAttachment(f)).find(Boolean);
    await recordProcessedEmail({
      messageId: dedupeId,
      kind: parsed.kind,
      status: 'skipped',
      reason:
        parsed.kind === 'pet'
          ? 'no_approved_pet_attachment'
          : anyKind
            ? 'no_approved_gaf_attachment'
            : 'no_approved_gaf_attachment',
    });
    return {
      action: 'skipped',
      reason: parsed.kind === 'pet' ? 'no_approved_pet_attachment' : 'no_approved_gaf_attachment',
      kind: parsed.kind,
    };
  }

  const attachment = attachments.find(
    (a) => a.filename.toLowerCase() === matchedName.toLowerCase()
  );
  if (!attachment?.download_url) {
    await recordProcessedEmail({
      messageId: dedupeId,
      kind: parsed.kind,
      status: 'failed',
      reason: 'attachment_missing_download_url',
    });
    return { action: 'skipped', reason: 'attachment_missing_download_url', kind: parsed.kind };
  }

  const match = await findBookingForApproval(
    propertyId,
    parsed.kind,
    parsed.checkInDate,
    parsed.checkOutDate
  );

  if (match && 'ambiguous' in match && match.ambiguous) {
    await recordProcessedEmail({
      messageId: dedupeId,
      kind: parsed.kind,
      status: 'skipped',
      reason: `ambiguous_multiple_bookings (${match.matchCount})`,
    });
    return {
      action: 'skipped',
      reason: `ambiguous_multiple_bookings (${match.matchCount})`,
      kind: parsed.kind,
    };
  }

  if (!match || !('booking' in match)) {
    await recordProcessedEmail({
      messageId: dedupeId,
      kind: parsed.kind,
      status: 'skipped',
      reason: 'no_booking_found',
    });
    return { action: 'skipped', reason: 'no_booking_found', kind: parsed.kind };
  }

  const bookingId = match.booking.id;
  const bytes = await downloadAttachmentBytes(attachment.download_url);
  const pdfUrl = await uploadApprovedPdf({
    kind: parsed.kind,
    propertyId,
    bookingId,
    bytes,
  });

  const payload: Record<string, string> =
    parsed.kind === 'gaf'
      ? {
          approved_gaf_pdf_url: pdfUrl,
          document_completion_target: 'PENDING_GAF',
        }
      : {
          approved_pet_pdf_url: pdfUrl,
          document_completion_target: 'PENDING_PET_REQUEST',
        };

  await WorkflowOrchestrator.transition(
    bookingId,
    'PENDING_DOCUMENTS',
    payload,
    { ...APPROVAL_INTAKE_DEV_CONTROLS },
    false,
    buildActorContext('email_inbound', { emailInbound: 'resend_inbound' })
  );

  try {
    const organizationId = await resolveOrganizationIdForProperty(propertyId);
    const guestName = String(match.booking.primary_guest_name ?? '').trim() || 'A guest';
    await createNotification({
      organizationId,
      propertyId,
      type: parsed.kind === 'gaf' ? 'booking_gaf_auto_approved' : 'booking_pet_auto_approved',
      title: parsed.kind === 'gaf' ? 'GAF auto-approved' : 'Pet document auto-approved',
      body: `${guestName}'s ${parsed.kind === 'gaf' ? 'GAF' : 'pet'} document was auto-approved.`,
      bookingId,
      metadata: bookingNotificationMetadata(match.booking),
      dedupeKey: `${bookingId}:${parsed.kind === 'gaf' ? 'booking_gaf_auto_approved' : 'booking_pet_auto_approved'}`,
    });
  } catch (err) {
    console.error('[approval-email-webhook] Could not create notification (non-fatal):', err);
  }

  await recordProcessedEmail({
    messageId: dedupeId,
    kind: parsed.kind,
    status: 'applied',
    bookingId,
  });

  return { action: 'applied', bookingId, kind: parsed.kind };
}

servePublic('approval-email-webhook', async (req) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const secret = (Deno.env.get('RESEND_INBOUND_WEBHOOK_SECRET') ?? '').trim();
  if (!secret) {
    console.error('[approval-email-webhook] RESEND_INBOUND_WEBHOOK_SECRET is not set');
    return jsonError(req, 'Webhook not configured', 503);
  }

  const rawBody = await req.text();
  const svixId = req.headers.get('svix-id') ?? '';
  const svixTimestamp = req.headers.get('svix-timestamp') ?? '';
  const svixSignature = req.headers.get('svix-signature') ?? '';

  const valid = await verifyResendWebhookSignature(
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
    secret
  );
  if (!valid) {
    const limited = await rateLimitGate(req, {
      scope: 'approval-email-webhook-bad-signature',
      identity: identityFromRequest(req),
      limit: 30,
      windowSec: 60,
    });
    if (limited) return limited;
    return jsonError(req, 'Invalid signature', 403);
  }

  let event: ResendReceivedEvent;
  try {
    event = JSON.parse(rawBody) as ResendReceivedEvent;
  } catch {
    return jsonError(req, 'Invalid JSON', 400);
  }

  if (event.type !== 'email.received') {
    return new Response(JSON.stringify({ success: true, ignored: true, type: event.type }), {
      status: 200,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await processReceivedEmail(event);
    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[approval-email-webhook] process error:', error);
    // Return 200 for permanent skip-style failures after recording when possible;
    // 500 lets Resend retry transient failures.
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
