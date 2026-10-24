export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'airbnb' | 'web';
export type ConversationType = 'dm' | 'comment';
export type ReplyStatus = 'pending' | 'replied' | 'none';
export type MessageDirection = 'inbound' | 'outbound';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export type MetaInboxScopeSource = 'org' | 'property' | 'parking';

export type InboxScopeFilter = {
  propertyId?: string | null;
  parkingId?: string | null;
};

export type SocialChannelConnectionRow = {
  id: string;
  organization_id: string;
  platform: SocialPlatform;
  external_account_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  encrypted_access_token: string | null;
  token_expires_at: string | null;
  meta_page_id: string | null;
  meta_ig_user_id: string | null;
  status: ConnectionStatus;
  webhook_subscribed_at: string | null;
  webhook_last_verified_at?: string | null;
  webhook_verify_attempts?: number;
  last_sync_at: string | null;
  error_message: string | null;
  property_id?: string | null;
  parking_id?: string | null;
  meta_backfill_phase?: 'messenger' | 'instagram' | null;
  meta_backfill_next_url?: string | null;
  meta_backfill_done?: boolean;
  updated_at?: string;
};

export type SocialConversationRow = {
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
  property_id?: string | null;
  parking_id?: string | null;
  guest_user_id?: string | null;
  connection_status?: ConnectionStatus | null;
  inquiry_check_in?: string | null;
  inquiry_check_out?: string | null;
  guest_last_read_at?: string | null;
  host_last_read_at?: string | null;
  guest_unread_count?: number;
};

export type SocialMessageRow = {
  id: string;
  organization_id: string;
  conversation_id: string;
  direction: MessageDirection;
  external_message_id: string;
  body_text: string | null;
  attachments: unknown[];
  sent_at: string;
  delivery_status: string | null;
  message_tag?: 'human_agent' | null;
  sent_by_user_id: string | null;
  is_ai_generated: boolean;
  read_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_message_id?: string | null;
  reply_preview_text?: string | null;
  /** `voice` for turns written from a Gemini Live voice receptionist session; default `text`. */
  source_mode?: 'text' | 'voice';
  /** `template` when the reply carries a rendered property template snapshot. */
  message_kind?: 'text' | 'template';
  template_snapshot?: unknown | null;
};

export type SocialReplyTemplateRow = {
  id: string;
  organization_id: string;
  title: string;
  body_text: string;
  platform: SocialPlatform | null;
  conversation_type: ConversationType | 'all';
  sort_order: number;
  is_active: boolean;
};

export type InboxThreadFilter = {
  type?: ConversationType | 'all';
  status?: 'unread' | 'pending' | 'replied' | 'all';
  platform?: SocialPlatform | 'all';
  search?: string;
  cursor?: string;
  limit?: number;
  /** When set, web threads filtered to this property; Meta uses effective connection ids. */
  propertyId?: string | null;
  /** When set, web threads filtered to this parking; Meta uses effective connection ids. */
  parkingId?: string | null;
  /** Meta connection ids visible in this scope (org default and/or override). */
  metaConnectionIds?: string[] | null;
};
