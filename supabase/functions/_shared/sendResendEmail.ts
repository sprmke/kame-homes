/**
 * Single choke point for Resend transactional sends.
 * Always CID-inlines off-domain images (Storage logos, remote QR hosts, etc.)
 * so message HTML stays on the verified sending / app domain.
 */

import {
  inlineRemoteImagesInHtml,
  type ResendInlineAttachment,
} from './emailInlineRemoteImages.ts';
import { formatResendFromAddress } from './propertyEmailBranding.ts';

export type { ResendInlineAttachment };

export type SendResendEmailInput = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  reply_to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: ResendInlineAttachment[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  /** Label for thrown errors, e.g. "GAF email". */
  errorLabel?: string;
  /** Skip CID inlining (rare; tests). */
  skipInlineRemoteImages?: boolean;
};

export type SendResendEmailResult = {
  id?: string;
  inlinedImageCount: number;
};

function requireResendApiKey(): string {
  const key = Deno.env.get('RESEND_API_KEY')?.trim();
  if (!key) throw new Error('Missing RESEND_API_KEY');
  return key;
}

function asList(value: string | string[] | undefined): string[] | undefined {
  if (value == null) return undefined;
  const list = (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}

/**
 * POST to Resend `/emails` after rewriting untrusted remote images to CID attachments.
 */
export async function sendResendEmail(input: SendResendEmailInput): Promise<SendResendEmailResult> {
  const apiKey = requireResendApiKey();
  const to = asList(input.to);
  if (!to?.length) throw new Error('Resend send requires at least one recipient');

  let html = input.html;
  let attachments = [...(input.attachments ?? [])];
  let inlinedImageCount = 0;

  if (!input.skipInlineRemoteImages) {
    const inlined = await inlineRemoteImagesInHtml(html, {
      fromHeader: input.from,
      existingAttachments: attachments,
    });
    html = inlined.html;
    attachments = inlined.attachments;
    inlinedImageCount = inlined.inlinedCount;
  }

  const payload: Record<string, unknown> = {
    from: input.from.trim(),
    to,
    subject: input.subject,
    html,
  };

  const replyTo = asList(input.reply_to);
  if (replyTo) payload.reply_to = replyTo.length === 1 ? replyTo[0] : replyTo;

  const cc = asList(input.cc);
  if (cc) payload.cc = cc;

  const bcc = asList(input.bcc);
  if (bcc) payload.bcc = bcc;

  if (attachments.length > 0) payload.attachments = attachments;
  if (input.headers && Object.keys(input.headers).length > 0) payload.headers = input.headers;
  if (input.tags && input.tags.length > 0) payload.tags = input.tags;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const label = input.errorLabel?.trim() || 'email';
    throw new Error(
      `Failed to send ${label} (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`
    );
  }

  const sent = (await res.json().catch(() => ({}))) as { id?: string };
  if (inlinedImageCount > 0) {
    console.log(`[sendResendEmail] inlined ${inlinedImageCount} remote image(s)`, {
      resendId: sent.id ?? null,
    });
  }
  return { id: sent.id, inlinedImageCount };
}

/**
 * Parking / invite style helper: formats From and requires reply_to.
 * Prefer `sendResendEmail` for new call sites.
 */
export async function sendResendEmailWithDisplayName(input: {
  fromDisplayName: string;
  fromEmail: string;
  to: string;
  cc?: string[];
  replyTo: string;
  subject: string;
  html: string;
  errorLabel: string;
  attachments?: ResendInlineAttachment[];
}): Promise<void> {
  await sendResendEmail({
    from: formatResendFromAddress(input.fromDisplayName, input.fromEmail),
    to: input.to,
    cc: input.cc,
    reply_to: input.replyTo,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
    errorLabel: input.errorLabel,
  });
}
