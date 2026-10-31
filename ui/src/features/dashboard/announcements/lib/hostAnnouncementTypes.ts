export type HostAnnouncementSeverity = 'info' | 'warning' | 'critical';

export type HostAnnouncement = {
  id: string;
  title: string;
  body: string;
  severity: HostAnnouncementSeverity;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  scope: 'platform' | 'development';
  developmentName: string | null;
  updatedAt: string;
};

export function createHostAnnouncementId(): string {
  return `ann-${crypto.randomUUID().slice(0, 8)}`;
}

const HOST_ANNOUNCEMENT_MAX_BODY_TEXT_LENGTH = 4000;

/** Strip tags/entities to get the readable message — used for previews and length checks. */
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

/** Legacy rows stored plain text — wrap it in paragraphs so it renders like new WYSIWYG rows. */
export function ensureHostAnnouncementBodyHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || looksLikeHtml(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export function emptyHostAnnouncement(): Omit<HostAnnouncement, 'scope' | 'developmentName'> {
  const now = new Date().toISOString();
  return {
    id: createHostAnnouncementId(),
    title: '',
    body: '',
    severity: 'info',
    active: true,
    startsAt: null,
    endsAt: null,
    linkUrl: null,
    linkLabel: null,
    updatedAt: now,
  };
}

export type HostAnnouncementDraft = Omit<HostAnnouncement, 'scope' | 'developmentName'>;

export function parseHostAnnouncementDrafts(value: unknown): HostAnnouncementDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      const body = ensureHostAnnouncementBodyHtml(
        typeof row.body === 'string' ? row.body.trim() : ''
      );
      if (!id || !title || !body) return null;
      const severity =
        row.severity === 'critical' || row.severity === 'warning' || row.severity === 'info'
          ? row.severity
          : 'info';
      const updatedAt =
        typeof row.updatedAt === 'string' && row.updatedAt.trim()
          ? row.updatedAt
          : new Date().toISOString();
      return {
        id,
        title,
        body,
        severity,
        active: typeof row.active === 'boolean' ? row.active : true,
        startsAt: typeof row.startsAt === 'string' && row.startsAt.trim() ? row.startsAt : null,
        endsAt: typeof row.endsAt === 'string' && row.endsAt.trim() ? row.endsAt : null,
        linkUrl: typeof row.linkUrl === 'string' && row.linkUrl.trim() ? row.linkUrl.trim() : null,
        linkLabel:
          typeof row.linkLabel === 'string' && row.linkLabel.trim() ? row.linkLabel.trim() : null,
        updatedAt,
      } satisfies HostAnnouncementDraft;
    })
    .filter((entry): entry is HostAnnouncementDraft => entry !== null);
}

export function validateHostAnnouncements(
  announcements: Array<
    Pick<HostAnnouncementDraft, 'title' | 'body' | 'startsAt' | 'endsAt' | 'linkUrl' | 'linkLabel'>
  >
): string | null {
  for (const announcement of announcements) {
    if (!announcement.title.trim()) return 'Each announcement needs a title';
    if (!hostAnnouncementBodyPlainText(announcement.body)) {
      return 'Each announcement needs a message';
    }
    if (announcement.title.length > 160) return 'Announcement title is too long';
    if (
      hostAnnouncementBodyPlainText(announcement.body).length >
      HOST_ANNOUNCEMENT_MAX_BODY_TEXT_LENGTH
    ) {
      return 'Announcement message is too long';
    }
    if (announcement.linkLabel && announcement.linkLabel.length > 80) {
      return 'Link label is too long';
    }
    if (announcement.linkUrl) {
      try {
        const parsed = new URL(announcement.linkUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return 'Link URL must start with http:// or https://';
        }
      } catch {
        return 'Link URL must start with http:// or https://';
      }
    }
    if (announcement.startsAt && announcement.endsAt) {
      if (Date.parse(announcement.startsAt) > Date.parse(announcement.endsAt)) {
        return 'Announcement end must be after start';
      }
    }
  }
  return null;
}
