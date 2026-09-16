import type { SupabaseClient } from './supabaseJs.ts';

export type HostAnnouncementSeverity = 'info' | 'warning' | 'critical';

export type HostAnnouncementRecord = {
  id: string;
  title: string;
  body: string;
  severity: HostAnnouncementSeverity;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  updatedAt: string;
};

export type HostAnnouncementDto = HostAnnouncementRecord & {
  scope: 'platform' | 'development';
  developmentName: string | null;
};

const SEVERITY_ORDER: Record<HostAnnouncementSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const HOST_ANNOUNCEMENT_MAX_TITLE = 160;
/** Message is authored as rich-text HTML — this caps the plain-text length, not raw markup. */
export const HOST_ANNOUNCEMENT_MAX_BODY = 4000;
export const HOST_ANNOUNCEMENT_MAX_LINK_LABEL = 80;

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Strip tags/entities for length checks and plain-text consumers (e.g. the AI assistant). */
export function hostAnnouncementBodyPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Legacy rows stored plain text — wrap it in paragraphs so old announcements render like the
 *  new rich-text ones instead of losing their line breaks. */
export function ensureHostAnnouncementBodyHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || looksLikeHtml(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNullableIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const text = readString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeSeverity(value: unknown): HostAnnouncementSeverity {
  if (value === 'critical' || value === 'warning' || value === 'info') return value;
  return 'info';
}

export function createHostAnnouncementId(): string {
  return `ann-${crypto.randomUUID().slice(0, 8)}`;
}

export function parseHostAnnouncements(value: unknown): HostAnnouncementRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const id = readString(row.id);
      const title = readString(row.title);
      const body = ensureHostAnnouncementBodyHtml(readString(row.body));
      if (!id || !title || !body) return null;
      const updatedAt = readNullableIso(row.updatedAt) ?? new Date().toISOString();
      return {
        id,
        title,
        body,
        severity: normalizeSeverity(row.severity),
        active: readBoolean(row.active, true),
        startsAt: readNullableIso(row.startsAt),
        endsAt: readNullableIso(row.endsAt),
        linkUrl: readString(row.linkUrl) || null,
        linkLabel: readString(row.linkLabel) || null,
        updatedAt,
      } satisfies HostAnnouncementRecord;
    })
    .filter((entry): entry is HostAnnouncementRecord => entry !== null);
}

export function hostAnnouncementContentKey(
  announcement: Omit<HostAnnouncementRecord, 'id' | 'updatedAt'>
): string {
  return JSON.stringify({
    title: announcement.title,
    body: announcement.body,
    severity: announcement.severity,
    active: announcement.active,
    startsAt: announcement.startsAt,
    endsAt: announcement.endsAt,
    linkUrl: announcement.linkUrl,
    linkLabel: announcement.linkLabel,
  });
}

/** Preserve updatedAt when content is unchanged so user dismiss state survives unrelated saves. */
export function stampHostAnnouncementsForSave(
  incoming: HostAnnouncementRecord[],
  existing: HostAnnouncementRecord[],
  nowIso = new Date().toISOString()
): HostAnnouncementRecord[] {
  const existingById = new Map(existing.map((row) => [row.id, row]));
  return incoming.map((row) => {
    const previous = existingById.get(row.id);
    if (previous && hostAnnouncementContentKey(previous) === hostAnnouncementContentKey(row)) {
      return { ...row, updatedAt: previous.updatedAt };
    }
    return { ...row, updatedAt: nowIso };
  });
}

function isSafeAnnouncementLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateHostAnnouncements(announcements: HostAnnouncementRecord[]): string | null {
  for (const announcement of announcements) {
    if (!announcement.title.trim()) return 'Each announcement needs a title';
    if (!hostAnnouncementBodyPlainText(announcement.body)) {
      return 'Each announcement needs a message';
    }
    if (announcement.title.length > HOST_ANNOUNCEMENT_MAX_TITLE) {
      return `Announcement title must be ${HOST_ANNOUNCEMENT_MAX_TITLE} characters or fewer`;
    }
    if (hostAnnouncementBodyPlainText(announcement.body).length > HOST_ANNOUNCEMENT_MAX_BODY) {
      return `Announcement message must be ${HOST_ANNOUNCEMENT_MAX_BODY} characters or fewer`;
    }
    if (
      announcement.linkLabel &&
      announcement.linkLabel.length > HOST_ANNOUNCEMENT_MAX_LINK_LABEL
    ) {
      return `Link label must be ${HOST_ANNOUNCEMENT_MAX_LINK_LABEL} characters or fewer`;
    }
    if (announcement.linkUrl && !isSafeAnnouncementLink(announcement.linkUrl)) {
      return 'Link URL must start with http:// or https://';
    }
    if (announcement.startsAt && announcement.endsAt) {
      if (Date.parse(announcement.startsAt) > Date.parse(announcement.endsAt)) {
        return 'Announcement end must be after start';
      }
    }
  }
  return null;
}

export function isHostAnnouncementLive(
  announcement: HostAnnouncementRecord,
  nowMs = Date.now()
): boolean {
  if (!announcement.active) return false;
  if (announcement.startsAt && Date.parse(announcement.startsAt) > nowMs) return false;
  if (announcement.endsAt && Date.parse(announcement.endsAt) < nowMs) return false;
  return true;
}

export function sortHostAnnouncements<T extends HostAnnouncementRecord>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

export function serializeHostAnnouncement(
  announcement: HostAnnouncementRecord,
  scope: 'platform' | 'development',
  developmentName: string | null
): HostAnnouncementDto {
  return {
    ...announcement,
    scope,
    developmentName,
  };
}

export async function loadPlatformHostAnnouncements(
  supabase: SupabaseClient
): Promise<HostAnnouncementRecord[]> {
  const { data, error } = await supabase
    .from('platform_host_settings')
    .select('announcements')
    .eq('id', true)
    .maybeSingle();

  if (error) {
    throw new Error(`[hostAnnouncements] platform load failed: ${error.message}`);
  }

  return parseHostAnnouncements(data?.announcements);
}

export async function loadDevelopmentHostAnnouncementsByNames(
  supabase: SupabaseClient,
  developmentNames: string[]
): Promise<Array<{ developmentName: string; announcements: HostAnnouncementRecord[] }>> {
  const names = [...new Set(developmentNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) return [];

  const { data, error } = await supabase
    .from('developments')
    .select('name, status, announcements:settings->announcements')
    .in('name', names);

  if (error) {
    throw new Error(`[hostAnnouncements] development load failed: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => row.status !== 'INACTIVE')
    .map((row) => ({
      developmentName: String(row.name ?? ''),
      announcements: parseHostAnnouncements(row.announcements),
    }))
    .filter((entry) => entry.developmentName);
}

export function mergeLiveHostAnnouncements(
  platform: HostAnnouncementRecord[],
  developmentGroups: Array<{ developmentName: string; announcements: HostAnnouncementRecord[] }>,
  nowMs = Date.now()
): HostAnnouncementDto[] {
  const merged: HostAnnouncementDto[] = [];

  for (const announcement of platform) {
    if (!isHostAnnouncementLive(announcement, nowMs)) continue;
    merged.push(serializeHostAnnouncement(announcement, 'platform', null));
  }

  for (const group of developmentGroups) {
    for (const announcement of group.announcements) {
      if (!isHostAnnouncementLive(announcement, nowMs)) continue;
      merged.push(serializeHostAnnouncement(announcement, 'development', group.developmentName));
    }
  }

  return sortHostAnnouncements(merged);
}
