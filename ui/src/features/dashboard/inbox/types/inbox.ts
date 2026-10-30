export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'airbnb' | 'web';
export type ConversationType = 'dm';
export type ReplyStatus = 'pending' | 'replied' | 'none';

import type { ChatActionMessage } from '@/lib/chat/chatMessageActions';
import {
  canHostEditMessage as canHostEditMessageInThread,
  canHostUnsendMessage as canHostUnsendMessageInThread,
} from '@/lib/chat/chatMessageActions';

export type InboxConnection = {
  id: string;
  platform: SocialPlatform;
  displayName: string | null;
  profileImageUrl: string | null;
  status: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  webhookSubscribed?: boolean;
  webhookLastVerifiedAt?: string | null;
  webhookVerifyAttempts?: number;
  webhookNeedsAttention?: boolean;
  errorMessage: string | null;
  /** Mock preview only — not a live API connection */
  isPreview?: boolean;
};

export type InboxConversation = {
  id: string;
  organization_id: string;
  connection_id: string;
  platform: SocialPlatform;
  conversation_type: ConversationType;
  external_thread_id: string;
  external_participant_id: string | null;
  participant_name: string | null;
  participant_avatar_url: string | null;
  subject_preview: string | null;
  last_message_at: string;
  last_inbound_at: string | null;
  unread_count: number;
  reply_status: ReplyStatus;
  messaging_window_expires_at: string | null;
  linked_post_id: string | null;
  linked_post_url: string | null;
  connection_status?: string | null;
  property_id?: string | null;
  guest_user_id?: string | null;
  inquiry_check_in?: string | null;
  inquiry_check_out?: string | null;
  property_name?: string | null;
  property_slug?: string | null;
};

export type InboxMessage = {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  body_text: string | null;
  attachments: unknown[];
  sent_at: string;
  delivery_status: string | null;
  message_tag?: 'human_agent' | null;
  is_ai_generated: boolean;
  read_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_message_id?: string | null;
  reply_preview_text?: string | null;
  message_kind?: 'text' | 'template';
  template_snapshot?: unknown | null;
};

/** Row in the composer Insert → Templates list (`chat-templates` edge function). */
export type ChatTemplateListItem = {
  templateKey: string;
  name: string;
  category: 'standard' | 'custom';
  description: string | null;
  sectionImageUrl: string | null;
  folderId: string | null;
  updatedAt: string | null;
};

export function canHostEditMessage(message: InboxMessage, messages: InboxMessage[]): boolean {
  if (message.message_kind === 'template') return false;
  return canHostEditMessageInThread(message as ChatActionMessage, messages);
}

export function canHostUnsendMessage(message: InboxMessage, messages: InboxMessage[]): boolean {
  return canHostUnsendMessageInThread(message as ChatActionMessage, messages);
}

export type InboxTemplate = {
  id: string;
  title: string;
  body_text: string;
  platform: SocialPlatform | null;
  conversation_type: ConversationType | 'all';
  sort_order: number;
  is_active: boolean;
};

export type SaveInboxTemplatePayload = {
  id?: string;
  title: string;
  bodyText: string;
  platform?: SocialPlatform | null;
};

export type InboxTab = 'messages' | 'channels' | 'quick-replies' | 'automation';

export type ThreadStatusFilter = 'all' | 'unread' | 'pending' | 'replied';
export type ThreadPlatformFilter = 'all' | SocialPlatform;

export type InboxAutomationSettings = {
  autoReplyEnabled: boolean;
  autoReplyMode: 'draft' | 'send';
  aiSystemPrompt: string;
  platformToggles: Record<string, boolean>;
  aiAvailable?: boolean;
  aiError?: string | null;
};

export type MetaPagePickerOption = {
  id: string;
  name: string;
  profileImageUrl: string | null;
  hasInstagram: boolean;
};
