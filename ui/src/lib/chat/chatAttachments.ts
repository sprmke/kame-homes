import type { InboxAttachmentPreview } from '@/features/dashboard/inbox/lib/inboxMessageAttachments';

export const CHAT_ATTACHMENT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

/** Keep in sync with `MAX_ATTACHMENTS` in `supabase/functions/_shared/guestChatAttachments.ts`. */
export const CHAT_MAX_ATTACHMENTS = 4;

export type ChatAttachmentPreview = InboxAttachmentPreview;

export { inboxAttachmentPreviews as chatAttachmentPreviews } from '@/features/dashboard/inbox/lib/inboxMessageAttachments';
