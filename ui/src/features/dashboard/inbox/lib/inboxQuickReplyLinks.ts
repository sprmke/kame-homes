import {
  guestCalendarPath,
  guestFormPath,
  guestMessagesPath,
  guestPropertyPath,
  guestShowcasePath,
} from '@/features/guest/lib/guestPublicPaths';

export const INBOX_QUICK_REPLY_LINK_FIELDS = [
  '{{calendar_link}}',
  '{{property_link}}',
  '{{form_link}}',
  '{{messages_link}}',
  '{{showcase_link}}',
  '{{map_link}}',
  '{{stay_guide_link}}',
] as const;

export type InboxQuickReplyLinkVars = {
  '{{calendar_link}}': string;
  '{{property_link}}': string;
  '{{form_link}}': string;
  '{{messages_link}}': string;
  '{{showcase_link}}': string;
  '{{map_link}}': string;
  '{{stay_guide_link}}': string;
};

export function buildInboxQuickReplyLinkVars(input: {
  propertySlug: string;
  mapsUrl?: string | null;
  stayGuideUrl?: string | null;
  inquiryCheckIn?: string | null;
  inquiryCheckOut?: string | null;
}): InboxQuickReplyLinkVars {
  const slug = input.propertySlug.trim();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  if (!slug || !origin) {
    return {
      '{{calendar_link}}': '',
      '{{property_link}}': '',
      '{{form_link}}': '',
      '{{messages_link}}': '',
      '{{showcase_link}}': '',
      '{{map_link}}': input.mapsUrl?.trim() ?? '',
      '{{stay_guide_link}}': input.stayGuideUrl?.trim() ?? '',
    };
  }

  const messagesParams = new URLSearchParams();
  const checkIn = input.inquiryCheckIn?.trim();
  const checkOut = input.inquiryCheckOut?.trim();
  if (checkIn && checkOut) {
    messagesParams.set('checkInDate', checkIn);
    messagesParams.set('checkOutDate', checkOut);
  }
  const messagesPath = guestMessagesPath(slug, messagesParams);

  return {
    '{{calendar_link}}': `${origin}${guestCalendarPath(slug)}`,
    '{{property_link}}': `${origin}${guestPropertyPath(slug)}`,
    '{{form_link}}': `${origin}${guestFormPath(slug)}`,
    '{{messages_link}}': `${origin}${messagesPath}`,
    '{{showcase_link}}': `${origin}${guestShowcasePath(slug)}`,
    '{{map_link}}': input.mapsUrl?.trim() ?? '',
    '{{stay_guide_link}}': input.stayGuideUrl?.trim() ?? '',
  };
}
