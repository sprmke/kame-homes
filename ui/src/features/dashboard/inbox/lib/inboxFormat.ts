import { formatDistanceToNow } from 'date-fns';

import type { SocialPlatform } from '@/features/dashboard/inbox/types/inbox';

export function platformLabel(platform: SocialPlatform): string {
  switch (platform) {
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    case 'airbnb':
      return 'Airbnb';
    case 'web':
      return 'Chat';
  }
}

export function formatInboxTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/** Meta allows replies within 24h of the guest's last message. */
export function messagingWindowExpiresAt(
  expiresAt: string | null,
  lastInboundAt: string | null
): string | null {
  if (lastInboundAt) {
    const d = new Date(lastInboundAt);
    d.setHours(d.getHours() + 24);
    return d.toISOString();
  }
  return expiresAt;
}

export function messagingWindowLabel(
  expiresAt: string | null,
  lastInboundAt: string | null = null
): string | null {
  const effective = messagingWindowExpiresAt(expiresAt, lastInboundAt);
  if (!effective) return null;
  const ms = new Date(effective).getTime() - Date.now();
  if (ms <= 0) return 'Reply window closed';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export function isMessagingWindowOpen(
  expiresAt: string | null,
  lastInboundAt: string | null = null
): boolean {
  const effective = messagingWindowExpiresAt(expiresAt, lastInboundAt);
  if (!effective) return false;
  return new Date(effective).getTime() > Date.now();
}

export const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  facebook: 'bg-blue-600',
  instagram: 'bg-gradient-to-br from-purple-600 to-pink-500',
  tiktok: 'bg-neutral-900 dark:bg-neutral-100',
  airbnb: 'bg-rose-500',
  web: 'bg-emerald-600',
};

export const PLATFORM_TAB_ACTIVE: Record<SocialPlatform | 'all', string> = {
  all: 'bg-primary',
  facebook: 'bg-blue-600',
  instagram: 'bg-gradient-to-r from-purple-600 to-pink-500',
  tiktok: 'bg-neutral-800 dark:bg-neutral-200',
  airbnb: 'bg-rose-500',
  web: 'bg-emerald-600',
};
