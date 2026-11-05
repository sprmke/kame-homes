/**
 * Marketing Studio library helpers for `marketing-templates` (pure, unit-tested).
 *
 * Library pages come from `list_marketing_library()` (one row per size group, no
 * design_json). Designs autosave by id; templates are frozen copies. Deletes are soft
 * (Recently deleted, 30 days).
 */

export const MARKETING_CONTENT_TYPES = ['calendar', 'design', 'video'] as const;
export type MarketingContentType = (typeof MARKETING_CONTENT_TYPES)[number];

export const MARKETING_ITEM_KINDS = ['design', 'template'] as const;
export type MarketingItemKind = (typeof MARKETING_ITEM_KINDS)[number];

export const LIBRARY_SORTS = ['updated', 'name', 'created'] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const LIBRARY_DEFAULT_LIMIT = 24;
export const LIBRARY_MAX_LIMIT = 60;
/** Bulk delete / restore cap per request. */
export const MAX_BULK_IDS = 50;
export const RECENTLY_DELETED_DAYS = 30;
export const TEMPLATE_USAGE_DAYS = 30;
const MAX_NAME_LENGTH = 120;
const MAX_QUERY_LENGTH = 80;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ASPECT_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isMarketingContentType(value: unknown): value is MarketingContentType {
  return (MARKETING_CONTENT_TYPES as readonly unknown[]).includes(value);
}

export function isMarketingItemKind(value: unknown): value is MarketingItemKind {
  return (MARKETING_ITEM_KINDS as readonly unknown[]).includes(value);
}

/** `preset:<id>` (built-in) or `tpl:<uuid>` (saved template). */
export function isTemplateRef(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.startsWith('preset:')) return PRESET_ID_RE.test(value.slice('preset:'.length));
  if (value.startsWith('tpl:')) return isUuid(value.slice('tpl:'.length));
  return false;
}

/** `undefined` = not sent, `null` = clear, string = valid ref, Error = invalid. */
export function parseTemplateRefField(value: unknown): string | null | undefined | Error {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return isTemplateRef(value) ? value : new Error('sourceTemplateId is not a valid template');
}

/** `undefined` = not sent, `null` = clear, uuid = group, Error = invalid. */
export function parseGroupIdField(value: unknown): string | null | undefined | Error {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return isUuid(value) ? value.toLowerCase() : new Error('groupId must be a UUID');
}

export function normalizeItemName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
  return name || null;
}

/** "Promo" → "Promo (copy)" → "Promo (copy 2)" → "Promo (copy 3)". */
export function duplicateName(name: string): string {
  const base = normalizeItemName(name) ?? 'Untitled';
  const match = base.match(/^(.*) \(copy(?: (\d+))?\)$/);
  if (!match) return `${base} (copy)`.slice(0, MAX_NAME_LENGTH);
  const stem = match[1] || 'Untitled';
  const next = match[2] ? Number(match[2]) + 1 : 2;
  return `${stem} (copy ${next})`.slice(0, MAX_NAME_LENGTH);
}

export type LibraryCursor = { key: string; id: string };

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeLibraryCursor(cursor: LibraryCursor): string {
  return base64UrlEncode(JSON.stringify([cursor.key, cursor.id]));
}

export function decodeLibraryCursor(value: string | null | undefined): LibraryCursor | null {
  if (!value || value.length > 400) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(value));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [key, id] = parsed;
    if (typeof key !== 'string' || key.length > 200 || !isUuid(id)) return null;
    return { key, id };
  } catch {
    return null;
  }
}

export type LibraryQuery = {
  contentType: MarketingContentType;
  kind: MarketingItemKind;
  themeKey: string | null;
  query: string | null;
  aspect: string | null;
  deleted: boolean;
  sort: LibrarySort;
  cursor: LibraryCursor | null;
  limit: number;
};

/** Parses `?view=library` params. Returns an Error message string on bad input. */
export function parseLibraryQuery(
  params: URLSearchParams,
  isThemeKey: (value: unknown) => boolean
): LibraryQuery | string {
  const contentType = params.get('content_type');
  if (!isMarketingContentType(contentType)) {
    return 'content_type must be calendar, design, or video';
  }
  const kindParam = params.get('kind') ?? 'design';
  if (!isMarketingItemKind(kindParam)) return 'kind must be design or template';

  const themeParam = params.get('theme_key');
  let themeKey: string | null = null;
  if (themeParam) {
    if (!isThemeKey(themeParam)) return 'theme_key is not a valid theme';
    themeKey = themeParam;
  }

  const rawQuery = params.get('q')?.replace(/\s+/g, ' ').trim() ?? '';
  const query = rawQuery ? rawQuery.slice(0, MAX_QUERY_LENGTH) : null;

  const aspectParam = params.get('size');
  const aspect = aspectParam && ASPECT_RE.test(aspectParam) ? aspectParam : null;

  const sortParam = params.get('sort') ?? 'updated';
  const sort: LibrarySort = (LIBRARY_SORTS as readonly string[]).includes(sortParam)
    ? (sortParam as LibrarySort)
    : 'updated';

  const limitParam = Number(params.get('limit'));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), LIBRARY_MAX_LIMIT)
      : LIBRARY_DEFAULT_LIMIT;

  return {
    contentType,
    kind: kindParam,
    themeKey,
    query,
    aspect,
    deleted: params.get('deleted') === '1' || params.get('deleted') === 'true',
    sort,
    cursor: decodeLibraryCursor(params.get('cursor')),
    limit,
  };
}

export type LibraryRpcRow = {
  id: string;
  name: string;
  kind: string;
  content_type: string;
  platform: string | null;
  aspect_preset: string | null;
  theme_key: string | null;
  group_id: string | null;
  source_template_id: string | null;
  thumbnail_path: string | null;
  ai_generated: boolean | null;
  is_collage: boolean | null;
  theme_hash: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  group_size: number | null;
  group_members: Array<{ id: string; aspectPreset: string | null; updatedAt: string }> | null;
  sort_key: string;
  /** Calendar styles when the row has no stored thumbnail (card draws an SVG from them). */
  preview_styles?: Record<string, unknown> | null;
};

export function serializeLibraryRow(
  row: LibraryRpcRow,
  thumbnailUrl: (path: string | null) => string | null
) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    contentType: row.content_type,
    platform: row.platform,
    aspectPreset: row.aspect_preset,
    themeKey: row.theme_key,
    groupId: row.group_id,
    sourceTemplateId: row.source_template_id,
    thumbnailUrl: thumbnailUrl(row.thumbnail_path),
    aiGenerated: row.ai_generated === true,
    isCollage: row.is_collage === true,
    themeHash: row.theme_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    groupSize: row.group_size ?? 1,
    groupMembers: (row.group_members ?? []).map((member) => ({
      id: member.id,
      aspectPreset: member.aspectPreset,
      updatedAt: member.updatedAt,
    })),
    previewStyles: row.thumbnail_path ? null : (row.preview_styles ?? null),
  };
}

/** Rows were fetched with `limit + 1`: trims the extra one and returns the next cursor. */
export function pageLibraryRows<T extends Pick<LibraryRpcRow, 'id' | 'sort_key'>>(
  rows: readonly T[],
  limit: number
): { rows: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { rows: [...rows], nextCursor: null };
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: last ? encodeLibraryCursor({ key: last.sort_key, id: last.id }) : null,
  };
}

/** Validated, de-duplicated ids for bulk delete / restore. Error message on bad input. */
export function parseIdList(body: Record<string, unknown>, searchId?: string | null) {
  const raw: unknown[] = Array.isArray(body.ids)
    ? body.ids
    : body.id !== undefined
      ? [body.id]
      : searchId
        ? [searchId]
        : [];
  if (raw.length === 0) return 'id is required';
  if (raw.length > MAX_BULK_IDS) return `At most ${MAX_BULK_IDS} items at a time`;
  const ids: string[] = [];
  for (const value of raw) {
    if (!isUuid(value)) return 'ids must be UUIDs';
    const id = value.toLowerCase();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Optimistic concurrency for autosave: the client sends the `updatedAt` it last saw.
 * Timestamps compare by instant (PostgREST and JS format the same instant differently).
 */
export function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  // Postgres keeps microseconds; Date.parse keeps milliseconds. Same ms = same save.
  return left === right;
}

const ACTIVITY_PATCH_FIELDS = new Set(['name', 'content_type']);

/**
 * PATCH fields worth an activity entry. Autosave resends content, size and theme every
 * few seconds; logging those would flood the org activity log (activity-log: N/A).
 */
export function patchActivityFields(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter((field) => ACTIVITY_PATCH_FIELDS.has(field));
}

export function recentlyDeletedCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - RECENTLY_DELETED_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function templateUsageSince(now: Date = new Date()): string {
  return new Date(now.getTime() - TEMPLATE_USAGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
