import {
  hostAnnouncementBodyPlainText,
  type HostAnnouncement,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';

export const HOST_ANNOUNCEMENT_LIST_BODY_MAX_CHARS = 140;

export function isLongHostAnnouncementBody(body: string): boolean {
  return hostAnnouncementBodyPlainText(body).length > HOST_ANNOUNCEMENT_LIST_BODY_MAX_CHARS;
}

export function formatHostAnnouncementUpdatedAt(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function findHostAnnouncementById(
  announcements: HostAnnouncement[],
  announcementId: string | undefined
): HostAnnouncement | null {
  if (!announcementId?.trim()) return null;
  return announcements.find((entry) => entry.id === announcementId) ?? null;
}
