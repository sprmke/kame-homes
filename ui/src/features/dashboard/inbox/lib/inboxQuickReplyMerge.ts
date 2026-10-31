import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  buildInboxQuickReplyLinkVars,
  INBOX_QUICK_REPLY_LINK_FIELDS,
} from '@/features/dashboard/inbox/lib/inboxQuickReplyLinks';
import type { InboxConversation } from '@/features/dashboard/inbox/types/inbox';

import { formatStayDateRange } from '@/utils/format/dates';

export const INBOX_QUICK_REPLY_MERGE_FIELDS = [
  '{{guest_name}}',
  '{{property_name}}',
  '{{check_in_date}}',
  '{{check_out_date}}',
  '{{inquiry_dates}}',
  ...INBOX_QUICK_REPLY_LINK_FIELDS,
] as const;

export type InboxQuickReplyMergeContext = {
  conversation: InboxConversation;
  booking?: BookingRow | null;
  propertySlug?: string | null;
  mapsUrl?: string | null;
  stayGuideUrl?: string | null;
};

function bookingDateToIso(mmDdYyyy: string | null | undefined): string | null {
  if (!mmDdYyyy?.trim()) return null;
  const [m, d, y] = mmDdYyyy.trim().split('-');
  if (!m || !d || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function resolveGuestName(ctx: InboxQuickReplyMergeContext): string {
  const fromConversation = ctx.conversation.participant_name?.trim();
  if (fromConversation) return fromConversation;
  const fromBooking =
    ctx.booking?.primary_guest_name?.trim() || ctx.booking?.guest_facebook_name?.trim();
  return fromBooking ?? '';
}

function resolveCheckInIso(ctx: InboxQuickReplyMergeContext): string | null {
  const fromBooking = bookingDateToIso(ctx.booking?.check_in_date);
  if (fromBooking) return fromBooking;
  return ctx.conversation.inquiry_check_in?.trim() || null;
}

function resolveCheckOutIso(ctx: InboxQuickReplyMergeContext): string | null {
  const fromBooking = bookingDateToIso(ctx.booking?.check_out_date);
  if (fromBooking) return fromBooking;
  return ctx.conversation.inquiry_check_out?.trim() || null;
}

function formatGuestDate(iso: string | null): string {
  if (!iso) return '';
  return formatStayDateRange(iso, null) ?? iso;
}

function replaceToken(text: string, token: string, value: string): string {
  if (!text.includes(token)) return text;
  if (value) return text.split(token).join(value);
  // Omit empty tokens so guests never see blanks or leftover placeholders.
  return text.split(token).join('');
}

function tidyMergedText(text: string): string {
  let out = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd();

  // Strip dangling separators left when link/date tokens were omitted (e.g. "Hi — /").
  for (let i = 0; i < 3; i++) {
    const next = out
      .replace(/\s+[—–|/-]+\s*$/g, '')
      .replace(/\s+[—–-]\s+[|/]/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\(\s*\)/g, '')
      .trimEnd();
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Sample context for the quick-reply form live preview. */
export function buildSampleQuickReplyMergeContext(): InboxQuickReplyMergeContext {
  return {
    conversation: {
      id: 'preview',
      organization_id: '',
      connection_id: '',
      platform: 'web',
      conversation_type: 'dm',
      external_thread_id: '',
      external_participant_id: null,
      participant_name: 'Jordan Santos',
      participant_avatar_url: null,
      subject_preview: null,
      last_message_at: '',
      last_inbound_at: null,
      unread_count: 0,
      reply_status: 'none',
      messaging_window_expires_at: null,
      linked_post_id: null,
      linked_post_url: null,
      inquiry_check_in: '2026-09-01',
      inquiry_check_out: '2026-09-03',
      property_slug: 'sample-property',
      property_name: 'Sample Property',
    },
    propertySlug: 'sample-property',
    mapsUrl: 'https://maps.example.com/property',
    stayGuideUrl: 'https://example.com/properties/sample-property/stay-guide?token=preview',
  };
}

/** Replace inbox quick-reply merge tokens using thread + optional matched booking. */
export function applyInboxQuickReplyMerge(
  template: string,
  ctx: InboxQuickReplyMergeContext
): string {
  const guestName = resolveGuestName(ctx);
  const propertyName = ctx.conversation.property_name?.trim() ?? '';
  const checkInIso = resolveCheckInIso(ctx);
  const checkOutIso = resolveCheckOutIso(ctx);
  const inquiryDates =
    checkInIso && checkOutIso ? (formatStayDateRange(checkInIso, checkOutIso) ?? '') : '';

  const slug = ctx.propertySlug?.trim() || ctx.conversation.property_slug?.trim() || '';
  const linkVars = buildInboxQuickReplyLinkVars({
    propertySlug: slug,
    mapsUrl: ctx.mapsUrl,
    stayGuideUrl: ctx.stayGuideUrl,
    inquiryCheckIn: checkInIso,
    inquiryCheckOut: checkOutIso,
  });

  let out = template;
  const replacements: [string, string][] = [
    ['{{guest_name}}', guestName],
    ['{{property_name}}', propertyName],
    ['{{check_in_date}}', formatGuestDate(checkInIso)],
    ['{{check_out_date}}', formatGuestDate(checkOutIso)],
    ['{{inquiry_dates}}', inquiryDates],
    ...(Object.entries(linkVars) as [string, string][]),
  ];
  for (const [token, value] of replacements) {
    out = replaceToken(out, token, value);
  }
  return tidyMergedText(out);
}
