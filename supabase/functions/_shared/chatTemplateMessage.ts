/**
 * Chat template messages — load, render and flatten a property template for
 * Guest Inbox / web chat. Email-category templates are never allowed here.
 *
 * The rendered HTML is snapshotted onto `social_messages.template_snapshot`
 * at send time. Web chat renders that snapshot as a rich card; Meta DMs get the
 * flattened plain text because Messenger/Instagram are text-only.
 */

import { resolveAppSettings } from './appSettings.ts';
import { createServiceClient } from './orgAuth.ts';
import { loadGuestFacingContactInfo } from './guestContactInfo.ts';
import { escapeHtml } from './renderEmailHtml.ts';
import { loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import { applyPropertyTemplatePlaceholders, buildBookingPlaceholderVars } from './propertyTemplateEmail.ts';
import {
  getBuiltinPropertyTemplate,
  getPropertyTemplateRow,
  isCustomTemplateKey,
  resolveCustomTemplateRow,
  resolvePropertyTemplateContent,
  type PropertyTemplateCategory,
} from './propertyTemplates.ts';
import type { GuestSubmission } from './types.ts';

export type ChatTemplateCategory = Exclude<PropertyTemplateCategory, 'email'>;

export type ChatTemplateSnapshot = {
  templateKey: string;
  name: string;
  category: ChatTemplateCategory;
  html: string;
  sectionImageUrl: string | null;
  propertyId: string;
};

export type ChatTemplateSource = {
  templateKey: string;
  name: string;
  category: ChatTemplateCategory;
  content: string;
  sectionImageUrl: string | null;
};

export type ChatTemplateConversation = {
  id?: string;
  participant_name?: string | null;
  property_id?: string | null;
  platform?: string | null;
};

/** Web chat message cap (`assertGuestWebMessagePayload`). */
export const MAX_CHAT_TEMPLATE_TEXT_CHARS = 4_000;
/** Meta Messenger / Instagram text limit. */
export const MAX_META_TEMPLATE_TEXT_CHARS = 2_000;

const TEMPLATE_KEY_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function isValidChatTemplateKey(value: string): boolean {
  return TEMPLATE_KEY_RE.test(value);
}

/** Loads a non-email property template. Throws a host-safe error when unusable. */
export async function loadChatTemplate(
  propertyId: string,
  templateKey: string
): Promise<ChatTemplateSource> {
  if (!propertyId) throw new Error('Property is required for a template');
  if (!isValidChatTemplateKey(templateKey)) throw new Error('Invalid template');

  if (isCustomTemplateKey(templateKey)) {
    const row = await getPropertyTemplateRow(propertyId, templateKey);
    if (!row) throw new Error('Template not found');
    if (row.category === 'email') throw new Error('Email templates cannot be sent in chat');
    const resolved = await resolveCustomTemplateRow(propertyId, templateKey);
    if (!resolved) throw new Error('Template not found');
    return {
      templateKey,
      name: row.name?.trim() || resolved.name,
      category: 'custom',
      content: resolved.content,
      sectionImageUrl: row.section_image_url?.trim() || null,
    };
  }

  const builtin = getBuiltinPropertyTemplate(templateKey);
  if (!builtin) throw new Error('Template not found');
  if (builtin.category === 'email') throw new Error('Email templates cannot be sent in chat');

  const resolved = await resolvePropertyTemplateContent(propertyId, builtin.key);
  return {
    templateKey,
    name: resolved.label,
    category: 'standard',
    content: resolved.content,
    sectionImageUrl: resolved.sectionImageUrl,
  };
}

/** Placeholder values for a chat context. Missing booking fields resolve to ''. */
export async function buildChatTemplateVars(input: {
  propertyId: string;
  conversation?: ChatTemplateConversation | null;
  booking?: GuestSubmission | null;
}): Promise<Record<string, string>> {
  const settings = await resolveAppSettings(input.propertyId);
  const [branding, contact] = await Promise.all([
    loadPropertyEmailBranding(input.propertyId),
    loadGuestFacingContactInfo(input.propertyId, settings),
  ]);

  const contactVars: Record<string, string> = {
    contact_name: escapeHtml(contact.contactName),
    contact_phone: escapeHtml(contact.contactPhone),
    contact_email: escapeHtml(contact.contactEmail),
    facebook_page_url: escapeHtml(contact.facebookPageUrl),
    airbnb_url: escapeHtml(contact.airbnbUrl),
  };

  if (input.booking) {
    return {
      ...buildBookingPlaceholderVars(input.booking, settings, {}, branding),
      ...contactVars,
    };
  }

  const guestName = input.conversation?.participant_name?.trim() || 'Guest';
  return {
    guest_name: escapeHtml(guestName),
    primary_guest_name: escapeHtml(guestName),
    guest_email: '',
    guest_phone: '',
    guest_facebook_name: '',
    property_name: escapeHtml(branding.propertyName),
    tower_and_unit_number: escapeHtml(branding.unitLabel),
    unit_number: escapeHtml(branding.unitLabel),
    check_in_date: '',
    check_out_date: '',
    check_in_time: '',
    check_out_time: '',
    nights: '',
    pax: '',
    special_requests: '',
    ...contactVars,
  };
}

/** Renders the admin-authored body with chat placeholder values. */
export function renderChatTemplateHtml(
  content: string,
  vars: Record<string, string>
): string {
  const filled = applyPropertyTemplatePlaceholders(content, vars);
  return filled
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/<p>\s*(?:&nbsp;)?\s*<\/p>/gi, '')
    .trim();
}

const BLOCK_TAG_RE = /<\/(?:p|div|li|ul|ol|h[1-6]|tr|table|blockquote)>/gi;
const BR_TAG_RE = /<br\s*\/?>/gi;
const LINK_TAG_RE = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const TAG_RE = /<[^>]+>/g;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)));
}

/** HTML to readable chat text. Links keep their URL so Meta guests can open them. */
export function chatTemplateHtmlToPlainText(html: string): string {
  let out = html;
  out = out.replace(LINK_TAG_RE, (match, href: string, label: string) => {
    const text = decodeEntities(label.replace(TAG_RE, '')).trim();
    const url = href.trim();
    if (!url) return text;
    if (!text || text === url) return url;
    return `${text} ${url}`;
  });
  out = out.replace(BR_TAG_RE, '\n');
  out = out.replace(BLOCK_TAG_RE, '\n');
  out = out.replace(TAG_RE, '');
  out = decodeEntities(out);
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Loads the optional booking used for date/guest placeholders. */
export async function loadChatTemplateBooking(
  propertyId: string,
  bookingId: string | null | undefined
): Promise<GuestSubmission | null> {
  if (!bookingId) return null;
  const { data, error } = await createServiceClient()
    .from('guest_submissions')
    .select('*')
    .eq('id', bookingId)
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) {
    console.warn('[chatTemplateMessage] booking lookup failed:', error.message);
    return null;
  }
  return (data as GuestSubmission | null) ?? null;
}

/**
 * Full render for a send. Returns the snapshot (web) plus flattened text used
 * for `body_text`, previews and Meta sends.
 */
export async function renderChatTemplateForChat(input: {
  propertyId: string;
  templateKey: string;
  conversation?: ChatTemplateConversation | null;
  bookingId?: string | null;
}): Promise<{ source: ChatTemplateSource; snapshot: ChatTemplateSnapshot; plainText: string }> {
  const source = await loadChatTemplate(input.propertyId, input.templateKey);
  const booking = await loadChatTemplateBooking(input.propertyId, input.bookingId);
  const vars = await buildChatTemplateVars({
    propertyId: input.propertyId,
    conversation: input.conversation,
    booking,
  });
  const html = renderChatTemplateHtml(source.content, vars);
  const plainText = chatTemplateHtmlToPlainText(html);
  return {
    source,
    plainText,
    snapshot: {
      templateKey: source.templateKey,
      name: source.name,
      category: source.category,
      html,
      sectionImageUrl: source.sectionImageUrl,
      propertyId: input.propertyId,
    },
  };
}
