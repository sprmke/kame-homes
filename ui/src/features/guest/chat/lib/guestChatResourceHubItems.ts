import {
  guestCalendarPath,
  guestFormPath,
  guestPropertyPath,
  guestShowcasePath,
} from '@/features/guest/lib/guestPublicPaths';

import type { ChatUrlLinkResourceKind } from '@/lib/chat/parseChatRichBlocks';
import { urlLinkCardMeta } from '@/lib/chat/parseChatRichBlocks';

export type GuestChatResourceHubItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  resourceKind: ChatUrlLinkResourceKind;
};

/** Self-serve property links for guests mid-conversation (check-in hub). */
export function buildGuestChatResourceHubItems(
  propertySlug: string,
  opts?: { stayGuideUrl?: string | null; tripPath?: string | null }
): GuestChatResourceHubItem[] {
  const slug = propertySlug.trim();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!slug || !origin) return [];

  const paths: { id: string; path: string }[] = [
    { id: 'calendar', path: guestCalendarPath(slug) },
    { id: 'listing', path: guestPropertyPath(slug) },
    { id: 'form', path: guestFormPath(slug) },
    { id: 'showcase', path: guestShowcasePath(slug) },
  ];

  const items = paths.map(({ id, path }) => {
    const href = `${origin}${path}`;
    const meta = urlLinkCardMeta(href);
    return {
      id,
      href,
      title: meta.title,
      subtitle: meta.subtitle,
      resourceKind: meta.resourceKind,
    };
  });

  const stayGuideUrl = opts?.stayGuideUrl?.trim() ?? '';
  if (stayGuideUrl) {
    const meta = urlLinkCardMeta(stayGuideUrl);
    items.unshift({
      id: 'stay-guide',
      href: stayGuideUrl,
      title: meta.title,
      subtitle: meta.subtitle,
      resourceKind: 'stayGuide',
    });
  }

  const tripPath = opts?.tripPath?.trim() ?? '';
  if (tripPath.startsWith('/')) {
    items.unshift({
      id: 'trip',
      href: `${origin}${tripPath}`,
      title: 'Your trip',
      subtitle: 'Booking, documents, payment',
      resourceKind: 'trip',
    });
  }

  return items;
}
