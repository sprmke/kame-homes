import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';

export const ASSISTANT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const ASSISTANT_ATTACHMENT_MAX_COUNT = 3;

export const ASSISTANT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const ASSISTANT_FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export type ChatAttachmentPayload = {
  name: string;
  mimeType: string;
  dataBase64: string;
};

export type ChatAttachmentMeta = {
  name: string;
  mimeType: string;
  size?: number;
  path?: string;
};

export type ChatSendInput = {
  text: string;
  /** Shown in the chat bubble; defaults to `text`. */
  displayText?: string;
  attachedContext?: AttachedContextItem[];
  attachments?: ChatAttachmentPayload[];
};

export function isAssistantImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function fileToBase64Payload(file: File): Promise<ChatAttachmentPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve({
        name: file.name,
        mimeType: file.type,
        dataBase64: comma >= 0 ? result.slice(comma + 1) : result,
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function validateAssistantFiles(files: File[], alreadyCount: number): string | null {
  if (alreadyCount + files.length > ASSISTANT_ATTACHMENT_MAX_COUNT) {
    return `Up to ${ASSISTANT_ATTACHMENT_MAX_COUNT} files`;
  }
  for (const file of files) {
    if (!ALLOWED_MIMES.has(file.type)) return 'Use a JPG, PNG, WebP, or PDF';
    if (file.size > ASSISTANT_ATTACHMENT_MAX_BYTES) return 'Each file must be under 4 MB';
  }
  return null;
}
