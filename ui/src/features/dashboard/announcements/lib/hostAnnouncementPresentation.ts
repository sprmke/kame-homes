import { AlertTriangle, Info, ShieldAlert, type LucideIcon } from 'lucide-react';

import type {
  HostAnnouncement,
  HostAnnouncementSeverity,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';

import { ATTENTION_SEVERITY_STYLES } from '@/lib/statusToneColors';

export const HOST_ANNOUNCEMENT_FEED_PAGE_SIZE = 5;

export const HOST_ANNOUNCEMENT_SEVERITY_ORDER: Record<HostAnnouncementSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function sortHostAnnouncementsByPriority(
  announcements: HostAnnouncement[]
): HostAnnouncement[] {
  return [...announcements].sort((a, b) => {
    const severityDiff =
      HOST_ANNOUNCEMENT_SEVERITY_ORDER[a.severity] - HOST_ANNOUNCEMENT_SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

export function hostAnnouncementScopeLabel(announcement: HostAnnouncement): string {
  if (announcement.scope === 'development' && announcement.developmentName) {
    return announcement.developmentName;
  }
  return 'Platform';
}

/** Stable React key when an announcement is edited (`updatedAt` changes). */
export function hostAnnouncementIdentityKey(
  announcement: Pick<HostAnnouncement, 'id' | 'scope' | 'developmentName' | 'updatedAt'>
): string {
  const development = announcement.developmentName?.trim() || 'platform';
  return `${announcement.scope}:${development}:${announcement.id}:${announcement.updatedAt}`;
}

type HostAnnouncementSeverityPresentation = {
  icon: LucideIcon;
  accentBorder: string;
  iconWrap: string;
  iconColor: string;
  severityLabel: string;
};

export const HOST_ANNOUNCEMENT_SEVERITY_PRESENTATION: Record<
  HostAnnouncementSeverity,
  HostAnnouncementSeverityPresentation
> = {
  info: {
    icon: Info,
    accentBorder: 'border-l-sky-500',
    iconWrap: 'bg-sky-50 ring-1 ring-inset ring-sky-200/80 dark:bg-sky-950/40 dark:ring-sky-500/25',
    iconColor: ATTENTION_SEVERITY_STYLES.info.iconWrap,
    severityLabel: 'Update',
  },
  warning: {
    icon: AlertTriangle,
    accentBorder: 'border-l-amber-500',
    iconWrap:
      'bg-amber-50 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-950/35 dark:ring-amber-500/25',
    iconColor: ATTENTION_SEVERITY_STYLES.warning.iconWrap,
    severityLabel: 'Attention',
  },
  critical: {
    icon: ShieldAlert,
    accentBorder: 'border-l-rose-500',
    iconWrap:
      'bg-rose-50 ring-1 ring-inset ring-rose-200/80 dark:bg-rose-950/40 dark:ring-rose-500/25',
    iconColor: ATTENTION_SEVERITY_STYLES.critical.iconWrap,
    severityLabel: 'Action required',
  },
};

export type HostAnnouncementFeedGroup = {
  key: string;
  label: string;
  announcements: HostAnnouncement[];
};

export function groupHostAnnouncementsForFeed(
  announcements: HostAnnouncement[]
): HostAnnouncementFeedGroup[] {
  const sorted = sortHostAnnouncementsByPriority(announcements);
  const platform = sorted.filter((entry) => entry.scope === 'platform');
  const development = sorted.filter((entry) => entry.scope === 'development');

  const groups: HostAnnouncementFeedGroup[] = [];

  if (platform.length > 0) {
    groups.push({ key: 'platform', label: 'Platform', announcements: platform });
  }

  const developmentNames = [
    ...new Set(
      development
        .map((entry) => entry.developmentName?.trim())
        .filter((name): name is string => Boolean(name))
    ),
  ].sort((a, b) => a.localeCompare(b));

  for (const name of developmentNames) {
    groups.push({
      key: `development:${name}`,
      label: name,
      announcements: development.filter((entry) => entry.developmentName === name),
    });
  }

  const unnamedDevelopment = development.filter((entry) => !entry.developmentName?.trim());
  if (unnamedDevelopment.length > 0) {
    groups.push({
      key: 'development:unknown',
      label: 'Development',
      announcements: unnamedDevelopment,
    });
  }

  return groups;
}

export type HostAnnouncementSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  platform: number;
  development: number;
};

export function summarizeHostAnnouncements(
  announcements: HostAnnouncement[]
): HostAnnouncementSummary {
  let critical = 0;
  let warning = 0;
  let info = 0;
  let platform = 0;
  let development = 0;

  for (const entry of announcements) {
    if (entry.severity === 'critical') critical += 1;
    else if (entry.severity === 'warning') warning += 1;
    else info += 1;

    if (entry.scope === 'platform') platform += 1;
    else development += 1;
  }

  return {
    total: announcements.length,
    critical,
    warning,
    info,
    platform,
    development,
  };
}
