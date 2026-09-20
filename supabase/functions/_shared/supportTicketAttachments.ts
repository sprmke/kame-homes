import { createServiceClient } from './orgAuth.ts';
import { assertWithinUploadLimit } from './uploadLimits.ts';
import type { SupportTicketScope } from './supportTicketScope.ts';

const SUPPORT_TICKET_BUCKET = 'support-ticket-attachments';

export type IncomingSupportTicketAttachment = {
  name: string;
  mimeType: string;
  size: number;
  path: string;
};

export function parseIncomingSupportTicketAttachments(
  raw: unknown
): IncomingSupportTicketAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .slice(0, 3)
    .map((item) => ({
      name: String(item.name ?? 'file').slice(0, 120),
      mimeType: String(item.mimeType ?? 'application/octet-stream'),
      size: typeof item.size === 'number' ? item.size : 0,
      path: String(item.path ?? ''),
    }))
    .filter((item) => item.path.length > 0);
}

export function attachmentStorageRoot(scope: SupportTicketScope): string {
  return scope.org?.id ?? 'guest';
}

/** Paths must live under `{orgId|guest}/{userId}/` for the authenticated submitter. */
export function isValidSupportTicketAttachmentPath(
  path: string,
  scope: SupportTicketScope
): boolean {
  if (!path || path.includes('..')) return false;
  const prefix = `${attachmentStorageRoot(scope)}/${scope.user.id}/`;
  return path.startsWith(prefix);
}

export function validateSupportTicketAttachments(
  raw: unknown,
  scope: SupportTicketScope
): IncomingSupportTicketAttachment[] {
  const attachments = parseIncomingSupportTicketAttachments(raw);
  for (const attachment of attachments) {
    if (!isValidSupportTicketAttachmentPath(attachment.path, scope)) {
      throw new Error('Invalid attachment path');
    }
  }
  return attachments;
}

export const SUPPORT_TICKET_ATTACHMENT_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
]);

/** Upload bytes to support-ticket-attachments for the authenticated submitter. */
export async function uploadSupportTicketAttachmentFromBytes(
  scope: SupportTicketScope,
  input: { bytes: Uint8Array; mimeType: string; fileName?: string }
): Promise<IncomingSupportTicketAttachment> {
  const mime = input.mimeType.trim().toLowerCase();
  if (!SUPPORT_TICKET_ATTACHMENT_MIME.has(mime)) {
    throw new Error('File must be JPEG, PNG, WebP, HEIC, MP4, or MOV');
  }
  assertWithinUploadLimit(
    { size: input.bytes.byteLength },
    mime.startsWith('video/') ? 'video' : 'image'
  );

  const safeName =
    String(input.fileName ?? 'upload')
      .replace(/[^\w.\-() ]+/g, '_')
      .slice(0, 120) || 'upload';
  const root = scope.org?.id ?? 'guest';
  const storagePath = `${root}/${scope.user.id}/${crypto.randomUUID()}-${safeName}`;

  const sb = createServiceClient();
  const { error: uploadError } = await sb.storage
    .from(SUPPORT_TICKET_BUCKET)
    .upload(storagePath, input.bytes, {
      upsert: false,
      contentType: mime,
      cacheControl: '31536000',
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  return {
    name: safeName,
    mimeType: mime,
    size: input.bytes.byteLength,
    path: storagePath,
  };
}
