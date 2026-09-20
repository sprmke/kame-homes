/**
 * Shared guest web-chat attachment upload for inbox replies.
 * Used by upload-inbox-chat-asset and AI assistant inbox send (from chat attachments).
 */

import { createServiceClient } from './orgAuth.ts';
import { downloadAssistantAttachment } from './assistantAttachmentApply.ts';
import type { NormalizedInboxAttachment } from './inboxAttachments.ts';
import { assertWithinUploadLimit, type UploadLimitKind } from './uploadLimits.ts';
import { formatPublicUrl } from './utils.ts';

export const INBOX_CHAT_ATTACHMENT_BUCKET = 'guest-chat-attachments';

export const INBOX_CHAT_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export function extensionForInboxChatMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower === 'image/png') return '.png';
  if (lower === 'image/webp') return '.webp';
  if (lower === 'application/pdf') return '.pdf';
  if (lower === 'image/heic') return '.heic';
  if (lower === 'image/heif') return '.heif';
  return '.jpg';
}

export function inboxChatUploadLimitKind(mime: string): UploadLimitKind {
  return mime.toLowerCase() === 'application/pdf' ? 'pdf' : 'image';
}

function sanitizeInboxFileName(fileName: string, ext: string): string {
  const trimmed = fileName
    .trim()
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120);
  return trimmed || `upload${ext}`;
}

/** Upload bytes to guest-chat-attachments and return a normalized inbox attachment. */
export async function uploadInboxChatAssetFromBytes(input: {
  organizationId: string;
  conversationId: string;
  bytes: Uint8Array;
  mimeType: string;
  fileName?: string;
}): Promise<NormalizedInboxAttachment> {
  const mime = input.mimeType.trim().toLowerCase();
  if (!INBOX_CHAT_ALLOWED_MIME.has(mime)) {
    throw new Error('File must be JPEG, PNG, WebP, HEIC, or PDF');
  }
  assertWithinUploadLimit({ size: input.bytes.byteLength }, inboxChatUploadLimitKind(mime));

  const ext = extensionForInboxChatMime(mime);
  const safeName = sanitizeInboxFileName(input.fileName ?? `upload${ext}`, ext);
  const storagePath = `${input.organizationId}/${input.conversationId}/${crypto.randomUUID()}${ext}`;

  const sb = createServiceClient();
  const { error: uploadError } = await sb.storage
    .from(INBOX_CHAT_ATTACHMENT_BUCKET)
    .upload(storagePath, input.bytes, {
      upsert: false,
      contentType: mime,
      cacheControl: '31536000',
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = sb.storage.from(INBOX_CHAT_ATTACHMENT_BUCKET).getPublicUrl(storagePath);
  const url = formatPublicUrl(publicUrl);

  return {
    kind: mime === 'application/pdf' ? 'file' : 'image',
    url,
    label: safeName,
  };
}

const MAX_ASSISTANT_INBOX_ATTACHMENTS = 3;

/** Copy assistant chat files into guest-chat-attachments for a web inbox reply. */
export async function uploadAssistantAttachmentsForInbox(input: {
  organizationId: string;
  userId: string;
  assistantConversationId: string;
  inboxConversationId: string;
  paths: string[];
}): Promise<NormalizedInboxAttachment[]> {
  const unique = [...new Set(input.paths.map((p) => p.trim()).filter(Boolean))].slice(
    0,
    MAX_ASSISTANT_INBOX_ATTACHMENTS
  );
  if (unique.length === 0) return [];

  const out: NormalizedInboxAttachment[] = [];
  for (const path of unique) {
    const resolved = await downloadAssistantAttachment({
      organizationId: input.organizationId,
      userId: input.userId,
      conversationId: input.assistantConversationId,
      path,
    });
    out.push(
      await uploadInboxChatAssetFromBytes({
        organizationId: input.organizationId,
        conversationId: input.inboxConversationId,
        bytes: resolved.bytes,
        mimeType: resolved.mimeType,
        fileName: path.split('/').pop(),
      })
    );
  }
  return out;
}
