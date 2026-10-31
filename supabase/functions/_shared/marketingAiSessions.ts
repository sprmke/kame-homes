/**
 * AI Studio conversations (pure helpers for `marketing-ai-sessions` and
 * `generate-marketing-media`, unit-tested).
 *
 * A session is one conversation: the first request and every refinement. Photo and
 * clip versions are `marketing_generation_jobs` rows; post versions are
 * `marketing_ai_post_versions` rows (an art-direction spec the client compiles).
 */

import { isUuid, normalizeItemName } from './marketingTemplateLibrary.ts';

export const AI_SESSION_OUTPUTS = ['post', 'image', 'video'] as const;
export type AiSessionOutput = (typeof AI_SESSION_OUTPUTS)[number];

export const AI_SESSION_DEFAULT_LIMIT = 24;
export const AI_SESSION_MAX_LIMIT = 60;
export const AI_POST_FORMATS = [
  'instagram-post',
  'instagram-portrait',
  'instagram-story',
  'facebook-post',
] as const;
export const AI_POST_GOALS = [
  'vibe',
  'promo',
  'amenity-spotlight',
  'feature-spotlight',
  'stay-info',
] as const;
/** First post turn makes four; a refinement or layout change makes one. */
export const MAX_POST_VERSIONS_PER_TURN = 4;
export const MAX_POST_PHOTOS = 6;
const MAX_SPEC_CHARS = 16_000;
const MAX_TURN_PROMPT_CHARS = 500;
const MAX_QUERY_LENGTH = 80;
const TITLE_CHARS = 60;

export function isAiSessionOutput(value: unknown): value is AiSessionOutput {
  return (AI_SESSION_OUTPUTS as readonly unknown[]).includes(value);
}

const FALLBACK_TITLE: Record<AiSessionOutput, string> = {
  post: 'Post',
  image: 'Photo',
  video: 'Clip',
};

/**
 * Title from the host's first message. Same rule as the migration backfill: the look
 * suffix ("\n\nStyle: …") is dropped, whitespace collapsed, 60 characters max, cut at
 * a word boundary when one is close.
 */
export function sessionTitleFromPrompt(prompt: unknown, output: AiSessionOutput): string {
  const text =
    typeof prompt === 'string' ? prompt.split('\n\nStyle:')[0]!.replace(/\s+/g, ' ').trim() : '';
  if (!text) return FALLBACK_TITLE[output];
  if (text.length <= TITLE_CHARS) return text;
  const cut = text.slice(0, TITLE_CHARS);
  const space = cut.lastIndexOf(' ');
  return (space >= TITLE_CHARS - 15 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, '');
}

export function normalizeSessionTitle(value: unknown): string | null {
  return normalizeItemName(value);
}

// ── List query ─────────────────────────────────────────────────────────────

export type AiSessionCursor = { at: string; id: string };

function base64UrlEncode(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

export function encodeSessionCursor(cursor: AiSessionCursor): string {
  return base64UrlEncode(JSON.stringify([cursor.at, cursor.id]));
}

export function decodeSessionCursor(value: string | null | undefined): AiSessionCursor | null {
  if (!value || value.length > 200) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(value));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [at, id] = parsed;
    if (typeof at !== 'string' || Number.isNaN(Date.parse(at)) || !isUuid(id)) return null;
    return { at, id };
  } catch {
    return null;
  }
}

export type AiSessionListQuery = {
  output: AiSessionOutput | null;
  query: string | null;
  deleted: boolean;
  cursor: AiSessionCursor | null;
  limit: number;
};

export function parseSessionListQuery(params: URLSearchParams): AiSessionListQuery | string {
  const outputParam = params.get('output');
  if (outputParam && !isAiSessionOutput(outputParam)) return 'output must be post, image, or video';
  const rawQuery = params.get('q')?.replace(/\s+/g, ' ').trim() ?? '';
  const limitParam = Number(params.get('limit'));
  return {
    output: outputParam ? (outputParam as AiSessionOutput) : null,
    query: rawQuery ? rawQuery.slice(0, MAX_QUERY_LENGTH) : null,
    deleted: params.get('deleted') === '1' || params.get('deleted') === 'true',
    cursor: decodeSessionCursor(params.get('cursor')),
    limit:
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), AI_SESSION_MAX_LIMIT)
        : AI_SESSION_DEFAULT_LIMIT,
  };
}

export type AiSessionRpcRow = {
  id: string;
  output: string;
  title: string;
  theme_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sort_at: string;
  version_count: number | null;
  in_flight: boolean | null;
  cover_url: string | null;
  cover_poster_url: string | null;
  cover_path: string | null;
  cover_media: string | null;
  cover_aspect: string | null;
};

/** Rows were fetched with `limit + 1`: trims the extra one and returns the next cursor. */
export function pageSessionRows<T extends Pick<AiSessionRpcRow, 'id' | 'sort_at'>>(
  rows: readonly T[],
  limit: number
): { rows: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { rows: [...rows], nextCursor: null };
  const page = rows.slice(0, limit);
  const last = page[page.length - 1]!;
  return { rows: page, nextCursor: encodeSessionCursor({ at: last.sort_at, id: last.id }) };
}

export function serializeSessionRow(
  row: AiSessionRpcRow,
  publicUrl: (path: string | null) => string | null
) {
  const media =
    row.cover_media === 'image' || row.cover_media === 'video' || row.cover_media === 'post'
      ? row.cover_media
      : null;
  return {
    id: row.id,
    output: row.output as AiSessionOutput,
    title: row.title,
    themeKey: row.theme_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    versionCount: Number(row.version_count ?? 0),
    inFlight: Boolean(row.in_flight),
    cover: media
      ? {
          media,
          url: media === 'post' ? publicUrl(row.cover_path) : row.cover_url,
          posterUrl: row.cover_poster_url,
          aspect: row.cover_aspect,
        }
      : null,
  };
}

// ── Post versions ──────────────────────────────────────────────────────────

export type PostVersionInput = {
  spec: Record<string, unknown>;
  goal: (typeof AI_POST_GOALS)[number];
  format: (typeof AI_POST_FORMATS)[number];
  photoUrls: string[];
  previewDataUrl: string | null;
};

/**
 * Validates `post-versions` items. The spec is the client's compiled-from contract;
 * the server only checks shape and size (the compiler re-normalizes on read).
 */
export function parsePostVersionInputs(value: unknown): PostVersionInput[] | string {
  if (!Array.isArray(value) || value.length === 0) return 'versions is required';
  if (value.length > MAX_POST_VERSIONS_PER_TURN) {
    return `At most ${MAX_POST_VERSIONS_PER_TURN} versions at a time`;
  }
  const out: PostVersionInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      return 'Each version must be an object';
    const raw = item as Record<string, unknown>;
    const spec = raw.spec;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return 'spec must be an object';
    if (JSON.stringify(spec).length > MAX_SPEC_CHARS) return 'spec is too large';
    if (!(AI_POST_GOALS as readonly unknown[]).includes(raw.goal)) return 'goal is not valid';
    if (!(AI_POST_FORMATS as readonly unknown[]).includes(raw.format)) return 'format is not valid';
    const photos = Array.isArray(raw.photoUrls) ? raw.photoUrls : [];
    if (photos.length > MAX_POST_PHOTOS) return `At most ${MAX_POST_PHOTOS} photos per post`;
    if (
      !photos.every(
        (url) => typeof url === 'string' && /^https?:\/\//.test(url) && url.length <= 2048
      )
    ) {
      return 'photoUrls must be http(s) URLs';
    }
    out.push({
      spec: spec as Record<string, unknown>,
      goal: raw.goal as PostVersionInput['goal'],
      format: raw.format as PostVersionInput['format'],
      photoUrls: photos as string[],
      previewDataUrl:
        typeof raw.previewDataUrl === 'string' && raw.previewDataUrl.startsWith('data:')
          ? raw.previewDataUrl
          : null,
    });
  }
  return out;
}

export function normalizeTurnPrompt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim().slice(0, MAX_TURN_PROMPT_CHARS);
  return text || null;
}

export function serializePostVersion(
  row: Record<string, unknown>,
  publicUrl: (path: string | null) => string | null
) {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    turnId: String(row.turn_id),
    prompt: (row.prompt as string | null) ?? null,
    goal: String(row.goal),
    format: String(row.format),
    spec: (row.spec ?? {}) as Record<string, unknown>,
    photoUrls: Array.isArray(row.photo_urls) ? (row.photo_urls as string[]) : [],
    previewUrl: publicUrl((row.preview_path as string | null) ?? null),
    parentVersionId: (row.parent_version_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

/**
 * A refinement must stay in its conversation's lane: a photo session only takes photo
 * jobs, and the parent must be a finished version of the same session.
 */
export function refineParentError(
  parent: {
    session_id: unknown;
    media_type: unknown;
    job_status: unknown;
    output_storage_path: unknown;
  } | null,
  sessionId: string,
  mediaType: 'image' | 'video'
): string | null {
  if (!parent) return 'The version to refine was not found';
  if (parent.session_id !== sessionId) return 'That version belongs to another conversation';
  if (parent.media_type !== mediaType) return 'That version is a different kind of media';
  if (mediaType === 'image' && (parent.job_status !== 'completed' || !parent.output_storage_path)) {
    return 'That photo is not finished yet';
  }
  return null;
}
