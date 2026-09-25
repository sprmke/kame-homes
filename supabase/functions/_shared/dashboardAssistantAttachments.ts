/**
 * Validate + persist AI dashboard assistant chat attachments.
 * Bytes go to Storage (`ai-assistant-attachments`); Gemini gets inlineData for this turn only.
 */

import type { GeminiContentPart } from './ai/llmTools.ts';
import { createServiceClient } from './orgAuth.ts';
import { assertMimeMatchesBytes } from './sniffMime.ts';

export const ASSISTANT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const ASSISTANT_ATTACHMENT_MAX_COUNT = 3;
export const ASSISTANT_ATTACHMENT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export type IncomingAttachment = {
  name: string;
  mimeType: string;
  dataBase64: string;
};

export type StoredAttachment = {
  name: string;
  mimeType: string;
  size: number;
  path: string;
};

export function parseIncomingAttachments(raw: unknown): IncomingAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingAttachment[] = [];
  for (const item of raw.slice(0, ASSISTANT_ATTACHMENT_MAX_COUNT)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    const mimeType = typeof rec.mimeType === 'string' ? rec.mimeType.trim().toLowerCase() : '';
    const dataBase64 = typeof rec.dataBase64 === 'string' ? rec.dataBase64.trim() : '';
    if (!name || !mimeType || !dataBase64) continue;
    out.push({ name: name.slice(0, 120), mimeType, dataBase64 });
  }
  return out;
}

/** Decoded byte length of a base64 string without decoding it. */
export function decodedBase64Size(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeFileName(name: string): string {
  const trimmed = name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return (trimmed || 'file').slice(0, 80);
}

export async function persistAssistantAttachments(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
  attachments: IncomingAttachment[];
}): Promise<{ stored: StoredAttachment[]; geminiParts: GeminiContentPart[] }> {
  const stored: StoredAttachment[] = [];
  const geminiParts: GeminiContentPart[] = [];
  if (input.attachments.length === 0) return { stored, geminiParts };

  const sb = createServiceClient();

  for (const attachment of input.attachments) {
    if (!ASSISTANT_ATTACHMENT_MIMES.has(attachment.mimeType)) {
      throw new Error(`Unsupported file type: ${attachment.mimeType}`);
    }
    // Size from the base64 length first, so an oversized payload is never decoded into memory.
    if (decodedBase64Size(attachment.dataBase64) > ASSISTANT_ATTACHMENT_MAX_BYTES) {
      throw new Error(`File too large: ${attachment.name}`);
    }
    const bytes = base64ToBytes(attachment.dataBase64);
    if (bytes.byteLength === 0 || bytes.byteLength > ASSISTANT_ATTACHMENT_MAX_BYTES) {
      throw new Error(`File too large: ${attachment.name}`);
    }
    // The client-declared type is not trusted: the bytes must actually be that type.
    assertMimeMatchesBytes(bytes, attachment.mimeType);

    const path = `${input.organizationId}/${input.userId}/${input.conversationId}/${crypto.randomUUID()}-${safeFileName(attachment.name)}`;
    const { error } = await sb.storage.from('ai-assistant-attachments').upload(path, bytes, {
      contentType: attachment.mimeType,
      upsert: false,
      cacheControl: '31536000',
    });
    if (error) throw new Error(`Failed to store attachment: ${error.message}`);

    stored.push({
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: bytes.byteLength,
      path,
    });
    geminiParts.push({
      inlineData: { mimeType: attachment.mimeType, data: attachment.dataBase64 },
    });
  }

  return { stored, geminiParts };
}

const ASSISTANT_ATTACHMENT_BUCKET = 'ai-assistant-attachments';

/** Best-effort: remove stored files for a conversation. DB delete still proceeds if this fails. */
export async function removeConversationAttachments(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
}): Promise<void> {
  const sb = createServiceClient();
  const folder = `${input.organizationId}/${input.userId}/${input.conversationId}`;
  const { data, error } = await sb.storage.from(ASSISTANT_ATTACHMENT_BUCKET).list(folder);
  if (error || !data?.length) return;
  await sb.storage
    .from(ASSISTANT_ATTACHMENT_BUCKET)
    .remove(data.map((file) => `${folder}/${file.name}`));
}
