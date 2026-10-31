/**
 * Resolve AI assistant chat attachments for apply tools.
 * Paths must stay under `{orgId}/{userId}/{conversationId}/` in `ai-assistant-attachments`.
 */

import { createServiceClient } from './orgAuth.ts';

const ASSISTANT_ATTACHMENT_BUCKET = 'ai-assistant-attachments';

export type ResolvedAssistantAttachment = {
  path: string;
  bytes: Uint8Array;
  mimeType: string;
  size: number;
};

function normalizePath(path: string): string {
  return path.trim().replace(/^\/+/, '').replace(/\\/g, '/').replace(/\.\./g, '');
}

/** Build the expected folder prefix for this conversation's attachments. */
export function assistantAttachmentFolderPrefix(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
}): string {
  return `${input.organizationId}/${input.userId}/${input.conversationId}/`;
}

export function assertAssistantAttachmentPathAllowed(
  path: string,
  input: { organizationId: string; userId: string; conversationId: string }
): string {
  const raw = stripAttachmentPathNoise(path);
  if (!raw) throw new Error('attachmentPath is required');
  if (raw.includes('..')) throw new Error('Invalid attachment path');
  const normalized = normalizePath(raw);
  if (!normalized || normalized.includes('..')) throw new Error('Invalid attachment path');
  const prefix = assistantAttachmentFolderPrefix(input);
  if (!normalized.startsWith(prefix)) {
    throw new Error('Attachment is not from this conversation');
  }
  const rest = normalized.slice(prefix.length);
  if (!rest || rest.includes('/')) {
    throw new Error('Invalid attachment path');
  }
  return normalized;
}

/** Strip bucket / storage URL prefixes models sometimes echo into attachmentPath. */
function stripAttachmentPathNoise(path: string): string {
  let raw = path.trim();
  if (!raw) return raw;
  raw = raw.replace(/^ai-assistant-attachments\//i, '');
  raw = raw.replace(
    /^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\/ai-assistant-attachments\//i,
    ''
  );
  return raw;
}

/**
 * Resolve a model-supplied attachmentPath to a conversation-scoped storage key.
 * Accepts full `{org}/{user}/{conv}/{file}` paths, optional bucket prefixes, or a bare
 * filename that uniquely matches a file already stored for this conversation.
 */
export async function resolveAssistantAttachmentPath(
  path: string,
  input: { organizationId: string; userId: string; conversationId: string }
): Promise<string> {
  const stripped = stripAttachmentPathNoise(path);
  try {
    return assertAssistantAttachmentPathAllowed(stripped, input);
  } catch (firstErr) {
    const fileName = normalizePath(stripped).split('/').filter(Boolean).pop() ?? '';
    if (!fileName || fileName.includes('..')) throw firstErr;

    const sb = createServiceClient();
    const folder = `${input.organizationId}/${input.userId}/${input.conversationId}`;
    const { data, error } = await sb.storage.from(ASSISTANT_ATTACHMENT_BUCKET).list(folder);
    if (error || !data?.length) throw firstErr;

    const lower = fileName.toLowerCase();
    const match = data.find(
      (file) =>
        file.name === fileName ||
        file.name.endsWith(`-${fileName}`) ||
        file.name.toLowerCase().endsWith(lower)
    );
    if (!match?.name) throw firstErr;
    return assertAssistantAttachmentPathAllowed(`${folder}/${match.name}`, input);
  }
}

export async function downloadAssistantAttachment(input: {
  organizationId: string;
  userId: string;
  conversationId: string;
  path: string;
}): Promise<ResolvedAssistantAttachment> {
  const path = await resolveAssistantAttachmentPath(input.path, input);
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from(ASSISTANT_ATTACHMENT_BUCKET).download(path);
  if (error || !data) {
    throw new Error(
      error?.message?.includes('not found') || error?.message?.includes('Object not found')
        ? 'Attachment no longer available — please re-attach the file'
        : `Failed to load attachment: ${error?.message ?? 'unknown error'}`
    );
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error('Attachment file is empty');
  }
  const mimeType =
    typeof data.type === 'string' && data.type.trim()
      ? data.type.trim().toLowerCase()
      : guessMimeFromPath(path);
  return { path, bytes, mimeType, size: bytes.byteLength };
}

function guessMimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}
