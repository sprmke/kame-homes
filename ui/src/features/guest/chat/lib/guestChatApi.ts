import type { ChatActionMessage } from '@/lib/chat/chatMessageActions';
import {
  canGuestEditMessage as canGuestEditMessageInThread,
  canGuestUnsendMessage as canGuestUnsendMessageInThread,
} from '@/lib/chat/chatMessageActions';
import type { ChatReplyStatus } from '@/lib/chat/chatReplyStatus';
import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type EdgeJson = {
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

function unwrapEdgePayload(json: EdgeJson): Record<string, unknown> {
  if (!json.success) throw new Error(json.error ?? 'Request failed');
  const payload = json.data;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
  return json as Record<string, unknown>;
}

async function guestJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to message the host.');
  return token;
}

async function guestEdgePost(path: string, body: Record<string, unknown>) {
  const jwt = await guestJwt();
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as EdgeJson;
  return unwrapEdgePayload(json);
}

async function guestEdgeGet(path: string, search: URLSearchParams) {
  const jwt = await guestJwt();
  const qs = search.toString();
  const res = await fetch(`${FUNCTIONS_URL}/${path}${qs ? `?${qs}` : ''}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  });
  const json = (await res.json()) as EdgeJson;
  return unwrapEdgePayload(json);
}

export type GuestChatStartResult = {
  conversationId: string;
  property?: {
    id: string;
    slug: string;
    name: string;
  };
  parking?: {
    id: string;
    slug: string;
    name: string;
  };
  host: {
    organizationName: string;
    ownerName: string;
    ownerAvatarUrl: string | null;
  };
  inquiryCheckIn: string;
  inquiryCheckOut: string;
  replyStatus: ChatReplyStatus;
  voiceReceptionistEnabled: boolean;
  stayGuideUrl: string | null;
  /** Relative trip page path for the guest's current/next stay here. */
  tripPath?: string | null;
};

export type GuestChatResumeResult = {
  hasMessages: boolean;
  conversationId: string | null;
  inquiryCheckIn: string | null;
  inquiryCheckOut: string | null;
  replyStatus: ChatReplyStatus | null;
  property?: {
    id: string;
    slug: string;
    name: string;
  } | null;
  parking?: {
    id: string;
    slug: string;
    name: string;
  } | null;
  host: {
    organizationName: string;
    ownerName: string;
    ownerAvatarUrl: string | null;
  } | null;
  voiceReceptionistEnabled: boolean;
  stayGuideUrl: string | null;
  /** Relative trip page path for the guest's current/next stay here. */
  tripPath?: string | null;
};

async function guestEdgePatch(path: string, body: Record<string, unknown>) {
  const jwt = await guestJwt();
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as EdgeJson;
  return unwrapEdgePayload(json);
}

export type GuestChatAttachment = {
  kind: 'image' | 'file';
  url: string;
  label?: string;
};

export type GuestChatMessage = {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  body_text: string | null;
  attachments?: unknown[];
  sent_at: string;
  delivery_status?: string | null;
  is_ai_generated: boolean;
  read_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_message_id?: string | null;
  reply_preview_text?: string | null;
};

export function canGuestEditMessage(
  message: GuestChatMessage,
  messages: GuestChatMessage[]
): boolean {
  return canGuestEditMessageInThread(message as ChatActionMessage, messages);
}

export function canGuestUnsendMessage(
  message: GuestChatMessage,
  messages: GuestChatMessage[]
): boolean {
  return canGuestUnsendMessageInThread(message as ChatActionMessage, messages);
}

export async function startGuestWebChat(input: {
  propertySlug?: string;
  parkingSlug?: string;
  checkInDate: string;
  checkOutDate: string;
}): Promise<GuestChatStartResult> {
  const payload = await guestEdgePost('guest-web-chat-start', input);
  return payload as unknown as GuestChatStartResult;
}

export async function fetchGuestWebChatResume(input: {
  propertySlug?: string;
  parkingSlug?: string;
}): Promise<GuestChatResumeResult> {
  const params = new URLSearchParams();
  if (input.propertySlug?.trim()) {
    params.set('property_slug', input.propertySlug.trim());
  } else if (input.parkingSlug?.trim()) {
    params.set('parking_slug', input.parkingSlug.trim());
  }
  const payload = await guestEdgeGet('guest-web-chat-resume', params);
  return payload as unknown as GuestChatResumeResult;
}

export async function fetchGuestChatMessages(
  conversationId: string,
  before?: string
): Promise<{ messages: GuestChatMessage[]; hasMore: boolean; replyStatus?: ChatReplyStatus }> {
  const params = new URLSearchParams({ conversation_id: conversationId });
  if (before) params.set('before', before);
  const payload = await guestEdgeGet('guest-web-chat-messages', params);
  return {
    messages: (payload.messages as GuestChatMessage[] | undefined) ?? [],
    hasMore: !!payload.hasMore,
    replyStatus: payload.replyStatus as ChatReplyStatus | undefined,
  };
}

async function guestEdgePostForm(path: string, formData: FormData) {
  const jwt = await guestJwt();
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });
  const json = (await res.json()) as EdgeJson;
  return unwrapEdgePayload(json);
}

export async function uploadGuestChatAttachment(
  conversationId: string,
  file: File
): Promise<GuestChatAttachment> {
  const prepared = await prepareUpload(file, {
    imagePreset: 'CONTENT',
    surface: 'guest-chat-attachment',
  });
  if (prepared.error) throw new Error(prepared.error);

  const formData = new FormData();
  formData.append('file', prepared.file);
  formData.append('fileName', prepared.file.name);
  formData.append('conversationId', conversationId);
  const payload = await guestEdgePostForm('upload-guest-chat-asset', formData);
  return payload.attachment as GuestChatAttachment;
}

export async function sendGuestChatMessage(
  conversationId: string,
  text: string,
  opts?: { replyToMessageId?: string; attachments?: GuestChatAttachment[] }
): Promise<void> {
  await guestEdgePost('guest-web-chat-messages', {
    conversationId,
    text,
    replyToMessageId: opts?.replyToMessageId,
    attachments: opts?.attachments,
  });
}

export async function markGuestChatRead(conversationId: string): Promise<void> {
  await guestEdgePost('guest-web-chat-messages', {
    action: 'mark_read',
    conversationId,
  });
}

export async function editGuestChatMessage(
  conversationId: string,
  messageId: string,
  text: string
): Promise<GuestChatMessage> {
  const payload = await guestEdgePatch('guest-web-chat-messages', {
    conversationId,
    messageId,
    text,
  });
  return payload.message as GuestChatMessage;
}

export async function unsendGuestChatMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  await guestEdgePost('guest-web-chat-messages', {
    action: 'unsend',
    conversationId,
    messageId,
  });
}
