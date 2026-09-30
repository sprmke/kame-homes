/**
 * URL helpers for AI mode. The URL is the source of truth for scope and canvas state:
 * - scope comes from `/org/:orgSlug[/property|parking/:slug]/...`
 * - the conversation lives in `?chat=<conversationId>`
 * - the canvas is open unless `?canvas=off`
 */

export const CHAT_SEARCH_PARAM = 'chat';
export const CANVAS_SEARCH_PARAM = 'canvas';
export const CANVAS_CLOSED_VALUE = 'off';
export const MODE_SEARCH_PARAM = 'mode';

export type AssistantScope =
  | { kind: 'org'; orgSlug: string; rootPath: string }
  | { kind: 'property'; orgSlug: string; slug: string; rootPath: string }
  | { kind: 'parking'; orgSlug: string; slug: string; rootPath: string };

const SCOPE_RE = /^\/org\/([^/?#]+)(?:\/(property|parking)\/([^/?#]+))?/;

export function parseAssistantScope(pathname: string): AssistantScope | null {
  const match = SCOPE_RE.exec(pathname);
  if (!match) return null;
  const [, orgSlug, kind, slug] = match;
  if (kind === 'property' && slug) {
    return { kind, orgSlug, slug, rootPath: `/org/${orgSlug}/property/${slug}` };
  }
  if (kind === 'parking' && slug) {
    return { kind, orgSlug, slug, rootPath: `/org/${orgSlug}/parking/${slug}` };
  }
  return { kind: 'org', orgSlug, rootPath: `/org/${orgSlug}/dashboard` };
}

export function isCanvasOpen(search: string): boolean {
  return new URLSearchParams(search).get(CANVAS_SEARCH_PARAM) !== CANVAS_CLOSED_VALUE;
}

/** Search string with `?chat=` set (or removed when null). Keeps every other param. */
export function withChatParam(search: string, conversationId: string | null): string {
  const params = new URLSearchParams(search);
  if (conversationId) params.set(CHAT_SEARCH_PARAM, conversationId);
  else params.delete(CHAT_SEARCH_PARAM);
  const next = params.toString();
  return next ? `?${next}` : '';
}

/** Where "close canvas" goes: the scope root, canvas off, conversation kept. */
export function canvasClosedHref(pathname: string, conversationId: string | null): string {
  const scope = parseAssistantScope(pathname);
  const params = new URLSearchParams();
  if (conversationId) params.set(CHAT_SEARCH_PARAM, conversationId);
  params.set(CANVAS_SEARCH_PARAM, CANVAS_CLOSED_VALUE);
  return `${scope?.rootPath ?? pathname}?${params.toString()}`;
}

/** Same page with the canvas re-opened (drops `canvas=off`, keeps the rest). */
export function canvasOpenSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CANVAS_SEARCH_PARAM);
  const next = params.toString();
  return next ? `?${next}` : '';
}

/**
 * Appends `?chat=` to an in-app href so the conversation survives canvas navigation.
 * External and hash-only links pass through untouched.
 */
export function hrefWithChat(href: string, conversationId: string | null): string {
  if (!conversationId || !href.startsWith('/')) return href;
  const [pathAndSearch, hash = ''] = href.split('#');
  const [path, search = ''] = pathAndSearch.split('?');
  const params = new URLSearchParams(search);
  params.set(CHAT_SEARCH_PARAM, conversationId);
  params.delete(CANVAS_SEARCH_PARAM);
  return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

const FLAT_SECTIONS = new Set(['bookings', 'finance', 'maintenance', 'pricing', 'settings']);

/**
 * `dashboard-stats` attention hrefs are legacy flat paths (`/bookings?…`, `/finance?…`).
 * Rewrites them under the current scope root; absolute `/org/…` paths pass through.
 */
export function resolveScopedDashboardHref(href: string, pathname: string): string {
  if (!href.startsWith('/') || href.startsWith('/org/')) return href;
  const scope = parseAssistantScope(pathname);
  if (!scope) return href;
  const queryIndex = href.indexOf('?');
  const path = (queryIndex >= 0 ? href.slice(0, queryIndex) : href).replace(/^\/+/, '');
  const query = queryIndex >= 0 ? href.slice(queryIndex) : '';
  if (!FLAT_SECTIONS.has(path)) return href;
  const base = scope.kind === 'org' ? `/org/${scope.orgSlug}` : scope.rootPath;
  return `${base}/${path}${query}`;
}
