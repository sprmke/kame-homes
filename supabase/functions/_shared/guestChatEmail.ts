/**
 * Offline email when a host (or web auto-reply) sends an outbound web chat message.
 */

import { buildEmailCtaHtml, renderBrandedEmailShell } from './brandedEmailShell.ts';
import { loadAuthUserProfile } from './authUserProfile.ts';
import { resolveEmailPrimaryHex } from './emailBrandColor.ts';
import { parseInboxAttachmentPreviews } from './inboxAttachments.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { escapeHtml, loadEmailTemplate, replacePlaceholders } from './renderEmailHtml.ts';
import { socialInboxDb } from './socialInboxDb.ts';

const RESEND_API = 'https://api.resend.com/emails';

function previewFromMessage(bodyText: string | null, attachments: unknown): string {
  const trimmed = bodyText?.trim();
  if (trimmed) return trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed;
  if (parseInboxAttachmentPreviews(attachments).length > 0) return '(attachment)';
  return 'New message';
}

export async function maybeNotifyGuestOfHostWebReply(opts: {
  orgId: string;
  conversationId: string;
  externalMessageId: string;
}): Promise<void> {
  const sb = socialInboxDb();

  const { data: msg, error: msgError } = await sb
    .from('social_messages')
    .select('id, body_text, attachments, guest_reply_email_sent_at, direction')
    .eq('conversation_id', opts.conversationId)
    .eq('external_message_id', opts.externalMessageId)
    .eq('direction', 'outbound')
    .maybeSingle();
  if (msgError) throw new Error(msgError.message);
  if (!msg?.id || msg.guest_reply_email_sent_at) return;

  const { data: conv, error: convError } = await sb
    .from('social_conversations')
    .select(
      'guest_user_id, property_id, participant_name, organization_id, guest_last_read_at, last_message_at'
    )
    .eq('id', opts.conversationId)
    .eq('organization_id', opts.orgId)
    .eq('platform', 'web')
    .maybeSingle();
  if (convError) throw new Error(convError.message);
  const guestUserId = conv?.guest_user_id as string | null | undefined;
  if (!guestUserId) return;

  const guest = await loadAuthUserProfile(sb, guestUserId);
  if (!guest.email?.trim()) return;

  let propertyName = 'Your stay inquiry';
  const propertyId = conv?.property_id as string | null | undefined;
  if (propertyId) {
    const { data: property } = await sb
      .from('properties')
      .select('name, slug')
      .eq('id', propertyId)
      .maybeSingle();
    if (property?.name) propertyName = String(property.name);
  }

  const { data: orgRow } = await sb
    .from('organizations')
    .select('name, brand_color_hex')
    .eq('id', opts.orgId)
    .maybeSingle();

  const appOrigin = resolvePublicGuestAppOrigin(null);
  const messagesUrl = `${appOrigin}/account/stays`;

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) {
    console.warn('[guestChatEmail] RESEND_API_KEY or RESEND_FROM_EMAIL missing — skip notify');
    return;
  }

  const brandColor = (orgRow?.brand_color_hex as string | undefined)?.trim() || null;
  const primary = resolveEmailPrimaryHex(brandColor);
  const hostName = (orgRow?.name as string | undefined)?.trim() || 'Your host';
  const bodyTemplate = await loadEmailTemplate('guest-chat-reply');
  const bodyHtml = replacePlaceholders(bodyTemplate, {
    brand_color: primary,
    guest_name: escapeHtml(guest.name || 'there'),
    host_name: escapeHtml(hostName),
    message_preview: escapeHtml(previewFromMessage(msg.body_text, msg.attachments)),
    messages_cta: buildEmailCtaHtml('View conversation', messagesUrl, brandColor),
  });

  const html = await renderBrandedEmailShell({
    brandName: hostName,
    unitLabel: propertyName,
    emailTitle: 'New message',
    bodyHtml,
    brandColor,
    propertyId,
  });

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [guest.email],
      subject: `New message — ${propertyName}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const now = new Date().toISOString();
  await sb
    .from('social_messages')
    .update({ guest_reply_email_sent_at: now })
    .eq('id', msg.id)
    .is('guest_reply_email_sent_at', null);
}
