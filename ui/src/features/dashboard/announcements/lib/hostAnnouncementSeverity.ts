import type { HostAnnouncementSeverity } from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';

export const HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS: Record<HostAnnouncementSeverity, string> = {
  critical: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-border',
};
