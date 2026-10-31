/**
 * Normalize Meta message attachment payloads for storage + display.
 */

export type InboxAttachmentKind = 'image' | 'video' | 'audio' | 'file';

export type NormalizedInboxAttachment = {
  kind: InboxAttachmentKind;
  url: string;
  label?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Flatten Graph `{ data: [...] }`, webhook arrays, or single objects. */
export function normalizeAttachmentInput(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const obj = asRecord(raw);
  if (!obj) return [];
  if (Array.isArray(obj.data)) return obj.data;
  return [obj];
}

function kindFromType(type: string | undefined, mime: string | undefined): InboxAttachmentKind {
  const t = (type ?? mime ?? '').toLowerCase();
  if (t.includes('image') || t.startsWith('image/')) return 'image';
  if (t.includes('video') || t.startsWith('video/')) return 'video';
  if (t.includes('audio') || t.startsWith('audio/')) return 'audio';
  return 'file';
}

function pickUrl(obj: Record<string, unknown>): string | null {
  for (const key of ['url', 'file_url', 'preview_url', 'image_url']) {
    const v = obj[key];
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }

  for (const nestedKey of ['image_data', 'video_data', 'audio_data']) {
    const nested = asRecord(obj[nestedKey]);
    if (!nested) continue;
    for (const key of ['url', 'preview_url', 'file_url']) {
      const v = nested[key];
      if (typeof v === 'string' && v.startsWith('http')) return v;
    }
  }

  const payload = asRecord(obj.payload);
  if (payload) {
    for (const key of ['url', 'src', 'file_url']) {
      const v = payload[key];
      if (typeof v === 'string' && v.startsWith('http')) return v;
    }
  }

  return null;
}

export function parseInboxAttachmentPreviews(raw: unknown): NormalizedInboxAttachment[] {
  const out: NormalizedInboxAttachment[] = [];
  for (const item of normalizeAttachmentInput(raw)) {
    const obj = asRecord(item);
    if (!obj) continue;
    const url = pickUrl(obj);
    if (!url) continue;
    const type = typeof obj.type === 'string' ? obj.type : undefined;
    const mime = typeof obj.mime_type === 'string' ? obj.mime_type : undefined;
    const name = typeof obj.name === 'string' ? obj.name : undefined;
    out.push({
      kind: kindFromType(type, mime),
      url,
      label: name,
    });
  }
  return out;
}

export function messageNeedsAttachmentEnrichment(msg: {
  body_text: string | null;
  attachments: unknown;
  external_message_id?: string | null;
}): boolean {
  if (msg.body_text?.trim()) return false;
  if (!msg.external_message_id?.trim()) return false;
  return parseInboxAttachmentPreviews(msg.attachments).length === 0;
}
