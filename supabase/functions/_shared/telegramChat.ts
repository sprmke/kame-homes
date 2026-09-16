/**
 * Guest Chat Telegram alerts — notify hosts on every inbound web chat message.
 */

import { createClient } from './supabaseJs.ts';
import { DatabaseService } from './databaseService.ts';
import { DEFAULT_PUBLIC_GUEST_APP_ORIGIN } from './publicAppOrigin.ts';
import type { NormalizedInboxAttachment } from './inboxAttachments.ts';
import { normalizeTelegramTemplateText } from './telegramTemplateNormalize.ts';
import type { TelegramAssetScopeRef } from './propertyTelegramCredentials.ts';
import type { SocialConversationRow, SocialPlatform } from './socialInboxTypes.ts';

export type TelegramChatSettings = {
  id: number;
  property_id: string;
  enabled: boolean;
  notify_on_new_message: boolean;
  new_message_template: string;
  updated_at: string;
};

export const CHAT_NEW_MESSAGE_PLACEHOLDERS = [
  'guest_name',
  'property_name',
  'chat_source',
  'chat_content',
  'attachment_summary',
  'attachment_line',
  'conversation_link',
  'check_in_date',
  'check_out_date',
  'sent_at',
] as const;

export const CHAT_DEFAULT_NEW_MESSAGE_TEMPLATE = `💬 New guest chat

Property: {{property_name}}
Source: {{chat_source}}

Guest: {{guest_name}}
Message:
{{chat_content}}
{{attachment_line}}

Reply now:
{{conversation_link}}`;

const MANILA_TZ = 'Asia/Manila';

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export function sanitizeChatNewMessageTemplate(text: string): string {
  return normalizeTelegramTemplateText(text);
}

export function serializeChatSettings(row: TelegramChatSettings | Record<string, unknown>) {
  const r = row as TelegramChatSettings;
  return {
    enabled: Boolean(r.enabled),
    notifyOnNewMessage: r.notify_on_new_message !== false,
    newMessageTemplate: sanitizeChatNewMessageTemplate(
      typeof r.new_message_template === 'string' && r.new_message_template.trim()
        ? r.new_message_template
        : CHAT_DEFAULT_NEW_MESSAGE_TEMPLATE
    ),
    placeholdersReference: [...CHAT_NEW_MESSAGE_PLACEHOLDERS],
  };
}

/** Seed one chat settings row per property or parking slot (idempotent). */
export async function ensureTelegramChatSettings(
  propertyId?: string,
  parkingId?: string
): Promise<void> {
  const existing = await DatabaseService.getTelegramChatSettings(propertyId, parkingId);
  if (existing) return;

  const supabase = getSupabase();
  const row: Record<string, unknown> = {
    enabled: false,
    notify_on_new_message: true,
    new_message_template: CHAT_DEFAULT_NEW_MESSAGE_TEMPLATE,
  };
  if (propertyId) row.property_id = propertyId;
  if (parkingId) row.parking_id = parkingId;

  const { error } = await supabase.from('telegram_chat_settings').insert(row);
  if (error) {
    console.error('[ensureTelegramChatSettings]', error.message);
    throw new Error('Failed to seed Telegram chat settings');
  }
}

function applyPlaceholders(template: string, values: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out.replace(/\{\{[a-z0-9_]+\}\}/gi, '').trim();
}

function formatAttachmentSummary(attachments: NormalizedInboxAttachment[]): string {
  if (attachments.length === 0) return '';
  let images = 0;
  let files = 0;
  for (const a of attachments) {
    if (a.kind === 'image') images += 1;
    else files += 1;
  }
  const parts: string[] = [];
  if (images > 0) parts.push(images === 1 ? '1 image' : `${images} images`);
  if (files > 0) parts.push(files === 1 ? '1 file' : `${files} files`);
  return parts.join(', ');
}

function formatAttachmentLine(attachments: NormalizedInboxAttachment[]): string {
  if (attachments.length === 0) return '';
  const labels = attachments.map((a) => {
    const label = a.label?.trim();
    if (label) return label;
    return a.kind === 'image' ? 'Photo' : 'File';
  });
  return `\n📎 ${labels.join(', ')}`;
}

function formatChatContent(
  text: string | null | undefined,
  attachments: NormalizedInboxAttachment[]
): string {
  const trimmed = text?.trim() ?? '';
  if (trimmed) return trimmed.slice(0, 3500);
  if (attachments.length > 0) return '(attachment)';
  return '';
}

function formatInquiryDate(raw: string | null | undefined): string {
  if (!raw?.trim()) return '—';
  const ymd = raw.trim().slice(0, 10);
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return raw.trim();
  try {
    const dt = new Date(`${ymd}T12:00:00+08:00`);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TZ,
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(dt);
  } catch {
    return `${m}/${d}/${y}`;
  }
}

function formatSentAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: MANILA_TZ,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

async function resolveOrgSlug(organizationId: string): Promise<string | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .maybeSingle();
  const slug = typeof data?.slug === 'string' ? data.slug.trim() : '';
  return slug || null;
}

async function resolvePropertyName(propertyId: string | null | undefined): Promise<string> {
  if (!propertyId) return 'Property';
  const sb = getSupabase();
  const { data } = await sb.from('properties').select('name').eq('id', propertyId).maybeSingle();
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  return name || 'Property';
}

async function resolvePropertySlug(propertyId: string | null | undefined): Promise<string | null> {
  if (!propertyId) return null;
  const sb = getSupabase();
  const { data } = await sb.from('properties').select('slug').eq('id', propertyId).maybeSingle();
  const slug = typeof data?.slug === 'string' ? data.slug.trim() : '';
  return slug || null;
}

async function resolveParkingName(parkingId: string | null | undefined): Promise<string> {
  if (!parkingId) return 'Parking';
  const sb = getSupabase();
  const { data } = await sb.from('parkings').select('name').eq('id', parkingId).maybeSingle();
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  return name || 'Parking';
}

async function resolveParkingSlug(parkingId: string | null | undefined): Promise<string | null> {
  if (!parkingId) return null;
  const sb = getSupabase();
  const { data } = await sb.from('parkings').select('slug').eq('id', parkingId).maybeSingle();
  const slug = typeof data?.slug === 'string' ? data.slug.trim() : '';
  return slug || null;
}

function appOrigin(): string {
  const fromEnv = Deno.env.get('PUBLIC_GUEST_APP_ORIGIN')?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return DEFAULT_PUBLIC_GUEST_APP_ORIGIN.replace(/\/$/, '');
}

/** Human-readable channel label for Telegram templates. */
export function formatChatSourceLabel(
  platform: SocialPlatform | string | null | undefined
): string {
  switch (platform) {
    case 'web':
      return 'Web chat';
    case 'facebook':
      return 'Facebook Messenger';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    case 'airbnb':
      return 'Airbnb';
    default:
      return 'Guest chat';
  }
}

function inboxPlatformQueryParam(platform: SocialPlatform | string): string {
  if (platform === 'facebook' || platform === 'instagram' || platform === 'web') {
    return platform;
  }
  return 'all';
}

export function buildConversationInboxLink(
  orgSlug: string,
  conversationId: string,
  platform: SocialPlatform | string,
  opts?: { propertySlug?: string | null; parkingSlug?: string | null }
): string {
  const platformParam = inboxPlatformQueryParam(platform);
  const propertySlug = opts?.propertySlug?.trim() || null;
  const parkingSlug = opts?.parkingSlug?.trim() || null;
  const inboxBase = parkingSlug
    ? `${appOrigin()}/org/${encodeURIComponent(orgSlug)}/parking/${encodeURIComponent(parkingSlug)}/inbox`
    : propertySlug
      ? `${appOrigin()}/org/${encodeURIComponent(orgSlug)}/property/${encodeURIComponent(propertySlug)}/inbox`
      : `${appOrigin()}/org/${encodeURIComponent(orgSlug)}/properties`;
  return (
    `${inboxBase}` +
    `?conversationId=${encodeURIComponent(conversationId)}&platform=${encodeURIComponent(platformParam)}`
  );
}

type ChatNotifyScope = { propertyId?: string; parkingId?: string };

/** Listing whose telegram_chat_settings row drives send. */
async function resolveChatNotifyScope(
  conversation: SocialConversationRow
): Promise<ChatNotifyScope | null> {
  if (conversation.parking_id) {
    return { parkingId: conversation.parking_id };
  }

  if (conversation.property_id) {
    return { propertyId: conversation.property_id };
  }

  const sb = getSupabase();
  const { data: properties, error } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', conversation.organization_id)
    .order('name', { ascending: true });

  if (error) {
    console.warn('[telegramChat] resolve notify property:', error.message);
    return null;
  }

  for (const row of properties ?? []) {
    const id = typeof row.id === 'string' ? row.id : null;
    if (!id) continue;
    try {
      const settings = await DatabaseService.getTelegramChatSettings(id);
      if (!settings?.enabled || settings.notify_on_new_message === false) continue;
      const { resolvePropertyTelegramCredentials } =
        await import('./propertyTelegramCredentials.ts');
      const creds = await resolvePropertyTelegramCredentials('chat', { propertyId: id });
      if (creds.ok) return { propertyId: id };
    } catch {
      continue;
    }
  }

  return null;
}

export function buildChatMessagePlaceholders(input: {
  guestName: string;
  propertyName: string;
  chatSource: string;
  text: string | null | undefined;
  attachments: NormalizedInboxAttachment[];
  conversationLink: string;
  checkIn?: string | null;
  checkOut?: string | null;
  sentAt: string;
}): Record<string, string> {
  return {
    guest_name: input.guestName.trim() || 'Guest',
    property_name: input.propertyName,
    chat_source: input.chatSource,
    chat_content: formatChatContent(input.text, input.attachments),
    attachment_summary: formatAttachmentSummary(input.attachments),
    attachment_line: formatAttachmentLine(input.attachments),
    conversation_link: input.conversationLink,
    check_in_date: formatInquiryDate(input.checkIn),
    check_out_date: formatInquiryDate(input.checkOut),
    sent_at: formatSentAt(input.sentAt),
  };
}

export type ChatDraftRenderResult = {
  renderedText?: string;
  placeholders?: Record<string, string>;
  error?: string;
};

/** Sample placeholders for admin template preview / test send. */
export function buildChatPreviewSamplePlaceholders(propertyName?: string): Record<string, string> {
  return buildChatMessagePlaceholders({
    guestName: 'Juan Dela Cruz',
    propertyName: propertyName?.trim() || 'Azure North',
    chatSource: 'Web chat',
    text: 'Hi! Is June 18–20 still available for 2 guests?',
    attachments: [],
    conversationLink: `${appOrigin()}/org/demo/property/demo-unit/inbox?conversationId=00000000-0000-4000-8000-000000000001&platform=web`,
    checkIn: '2026-06-18',
    checkOut: '2026-06-20',
    sentAt: new Date().toISOString(),
  });
}

export async function renderChatDraftPreview(
  template: string,
  scope?: TelegramAssetScopeRef | null
): Promise<ChatDraftRenderResult> {
  const trimmed = sanitizeChatNewMessageTemplate(template);
  if (!trimmed) return { error: 'text is required' };

  let listingName = 'Azure North';
  if (scope?.parkingId) {
    listingName = await resolveParkingName(scope.parkingId);
  } else if (scope?.propertyId) {
    listingName = await resolvePropertyName(scope.propertyId);
  }
  const placeholders = buildChatPreviewSamplePlaceholders(listingName);
  return {
    renderedText: applyPlaceholders(trimmed, placeholders),
    placeholders,
  };
}

export async function verifyChatTelegramEnv(
  scope?: TelegramAssetScopeRef | null,
  overrides?: { botToken?: string; chatId?: string }
) {
  const { verifyPropertyTelegramChannel } = await import('./propertyTelegramCredentials.ts');
  return verifyPropertyTelegramChannel('chat', scope ?? null, overrides);
}

export async function sendChatDraftPreview(text: string, scope?: TelegramAssetScopeRef | null) {
  const rendered = await renderChatDraftPreview(text, scope);
  if (rendered.error || !rendered.renderedText) {
    return {
      sent: false,
      error: rendered.error ?? 'text is required',
      messageCharCount: 0,
    };
  }
  const { sendPropertyTelegramMessage } = await import('./propertyTelegramCredentials.ts');
  const r = await sendPropertyTelegramMessage('chat', rendered.renderedText, scope ?? null);
  return {
    sent: r.ok,
    error: r.error,
    messageCharCount: rendered.renderedText.length,
  };
}

/**
 * Fire-and-forget friendly: call after inbound guest message insert (web or Meta DM).
 * Never throws to callers — logs and returns.
 */
export async function notifyTelegramChatInbound(input: {
  conversation: SocialConversationRow;
  text: string | null | undefined;
  attachments: NormalizedInboxAttachment[];
  sentAt: string;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const notifyScope = await resolveChatNotifyScope(input.conversation);
  if (!notifyScope) {
    return { sent: false, skipped: 'no_listing' };
  }

  let row: Record<string, unknown> | null;
  try {
    row = await DatabaseService.getTelegramChatSettings(
      notifyScope.propertyId,
      notifyScope.parkingId
    );
  } catch (e) {
    console.warn('[telegramChat] load settings:', e);
    return { sent: false, error: e instanceof Error ? e.message : 'load_failed' };
  }

  if (!row || !row.enabled || row.notify_on_new_message === false) {
    return { sent: false, skipped: 'disabled' };
  }

  const template = sanitizeChatNewMessageTemplate(
    typeof row.new_message_template === 'string' && row.new_message_template.trim()
      ? row.new_message_template
      : CHAT_DEFAULT_NEW_MESSAGE_TEMPLATE
  );

  const orgSlug = await resolveOrgSlug(input.conversation.organization_id);
  if (!orgSlug) {
    return { sent: false, skipped: 'no_org_slug' };
  }

  const listingName = notifyScope.parkingId
    ? await resolveParkingName(notifyScope.parkingId)
    : await resolvePropertyName(notifyScope.propertyId);
  const propertySlug = notifyScope.propertyId
    ? await resolvePropertySlug(notifyScope.propertyId)
    : null;
  const parkingSlug = notifyScope.parkingId
    ? await resolveParkingSlug(notifyScope.parkingId)
    : null;

  const conversationLink = buildConversationInboxLink(
    orgSlug,
    input.conversation.id,
    input.conversation.platform,
    { propertySlug, parkingSlug }
  );

  const placeholders = buildChatMessagePlaceholders({
    guestName: input.conversation.participant_name ?? 'Guest',
    propertyName: listingName,
    chatSource: formatChatSourceLabel(input.conversation.platform),
    text: input.text,
    attachments: input.attachments,
    conversationLink,
    checkIn: input.conversation.inquiry_check_in,
    checkOut: input.conversation.inquiry_check_out,
    sentAt: input.sentAt,
  });

  const message = applyPlaceholders(template, placeholders);
  if (!message) {
    return { sent: false, skipped: 'empty_message' };
  }

  try {
    const { sendPropertyTelegramMessage } = await import('./propertyTelegramCredentials.ts');
    const r = await sendPropertyTelegramMessage('chat', message, notifyScope);
    if (!r.ok) {
      console.warn('[telegramChat] send failed:', r.error);
      return { sent: false, error: r.error };
    }
    return { sent: true };
  } catch (e) {
    console.warn('[telegramChat] send error:', e);
    return { sent: false, error: e instanceof Error ? e.message : 'send_failed' };
  }
}
