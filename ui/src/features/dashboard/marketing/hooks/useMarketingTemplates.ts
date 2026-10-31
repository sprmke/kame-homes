import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { usePropertyIdParam, scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type MarketingContentType = 'calendar' | 'design' | 'video';
/** `design` = the host's work (autosaves by id); `template` = frozen "Save as template" copy. */
export type MarketingItemKind = 'design' | 'template';

export type MarketingTemplateRecord = {
  id: string;
  name: string;
  contentType: MarketingContentType;
  platform: string | null;
  aspectPreset: string | null;
  designJson: Record<string, unknown>;
  /** Theme the item was made in; null for items saved before themes. */
  themeKey?: string | null;
  /** Stored thumbnail (Storage). Older rows may still embed `designJson.thumbnailDataUrl`. */
  thumbnailUrl?: string | null;
  kind?: MarketingItemKind;
  /** Same design in several sizes (AI runs, Copy to another size). */
  groupId?: string | null;
  /** Template it started from: `preset:<id>` or `tpl:<uuid>`. */
  sourceTemplateId?: string | null;
  deletedAt?: string | null;
  /** Same design in other sizes (single-item GET only). */
  groupMembers?: Array<{ id: string; aspectPreset: string | null; updatedAt: string }>;
  createdAt?: string;
  updatedAt: string;
};

export type SaveMarketingTemplatePayload = {
  name: string;
  contentType: MarketingContentType;
  platform?: string;
  aspectPreset?: string;
  designJson: Record<string, unknown>;
  /** Theme the item belongs to (`marketing_templates.theme_key`). */
  themeKey?: string | null;
  kind?: MarketingItemKind;
  groupId?: string | null;
  sourceTemplateId?: string | null;
};

/** Edge error with its HTTP status and machine code (`conflict`, `deleted`, plan codes). */
export class MarketingApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly data: Record<string, unknown>;

  constructor(message: string, status: number, code: string | null, data: Record<string, unknown>) {
    super(message);
    this.name = 'MarketingApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function isMarketingConflictError(error: unknown): error is MarketingApiError {
  return error instanceof MarketingApiError && error.status === 409 && error.code === 'conflict';
}

export function isMarketingDeletedError(error: unknown): error is MarketingApiError {
  return error instanceof MarketingApiError && error.status === 410;
}

async function parseEdgeJson<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    code?: string;
    data?: T;
  } & Record<string, unknown>;
  if (!res.ok || !json.success) {
    throw new MarketingApiError(
      json.error ?? 'Request failed',
      res.status,
      typeof json.code === 'string' ? json.code : null,
      json
    );
  }
  return json.data as T;
}

async function edgeRequest<T>(
  propertyId: string | null,
  init: { method?: string; query?: URLSearchParams; body?: unknown } = {}
): Promise<T> {
  const jwt = await getSessionJwt();
  const path = init.query?.toString()
    ? `marketing-templates?${init.query.toString()}`
    : 'marketing-templates';
  const res = await fetch(scopedFunctionsUrl(path, propertyId), {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  return parseEdgeJson<T>(res);
}

/** Legacy full list (every live row with design_json). Prefer the library endpoints. */
export async function fetchMarketingTemplates(
  propertyId: string | null
): Promise<MarketingTemplateRecord[]> {
  const data = await edgeRequest<{ templates: MarketingTemplateRecord[] }>(propertyId);
  return data.templates ?? [];
}

/** Latest design per theme + type, slim payload. Theme cards do not call this. */
export async function fetchMarketingShowcase(
  propertyId: string | null
): Promise<MarketingTemplateRecord[]> {
  const data = await edgeRequest<{ templates: MarketingTemplateRecord[] }>(propertyId, {
    query: new URLSearchParams({ view: 'showcase' }),
  });
  return data.templates ?? [];
}

export async function fetchMarketingTemplate(
  propertyId: string | null,
  id: string
): Promise<MarketingTemplateRecord> {
  return edgeRequest(propertyId, { query: new URLSearchParams({ id }) });
}

export async function saveMarketingTemplate(
  propertyId: string | null,
  payload: SaveMarketingTemplatePayload
): Promise<MarketingTemplateRecord> {
  return edgeRequest(propertyId, { method: 'POST', body: payload });
}

export type UpdateMarketingTemplatePayload = {
  id: string;
  name?: string;
  designJson?: Record<string, unknown>;
  aspectPreset?: string;
  platform?: string;
  themeKey?: string | null;
  /** Refresh only the stored thumbnail (image data URL). */
  thumbnailDataUrl?: string;
  /** Autosave: the updatedAt last seen; the edge answers 409 when it changed elsewhere. */
  ifUpdatedAt?: string;
};

export async function updateMarketingTemplate(
  propertyId: string | null,
  payload: UpdateMarketingTemplatePayload
): Promise<MarketingTemplateRecord> {
  return edgeRequest(propertyId, { method: 'PATCH', body: payload });
}

export type DuplicateMarketingTemplatePayload = {
  id: string;
  name?: string;
  kind?: MarketingItemKind;
  /** Join the source's size group (Copy to another size). */
  sameGroup?: boolean;
  aspectPreset?: string;
  platform?: string;
  /** Content override (the resized design). May carry `thumbnailDataUrl`. */
  designJson?: Record<string, unknown>;
};

export async function duplicateMarketingTemplate(
  propertyId: string | null,
  payload: DuplicateMarketingTemplatePayload
): Promise<MarketingTemplateRecord> {
  return edgeRequest(propertyId, { method: 'POST', body: { action: 'duplicate', ...payload } });
}

/** Moves items to Recently deleted (or deletes them for good with `permanent`). */
export async function deleteMarketingTemplates(
  propertyId: string | null,
  ids: string[],
  options: { permanent?: boolean } = {}
): Promise<string[]> {
  const data = await edgeRequest<{ ids: string[] }>(propertyId, {
    method: 'DELETE',
    body: { ids, permanent: options.permanent === true },
  });
  return data.ids ?? [];
}

/** @deprecated single-id form; moves the item to Recently deleted. */
export async function deleteMarketingTemplate(
  propertyId: string | null,
  templateId: string
): Promise<void> {
  await deleteMarketingTemplates(propertyId, [templateId]);
}

export async function restoreMarketingTemplates(
  propertyId: string | null,
  ids: string[]
): Promise<string[]> {
  const data = await edgeRequest<{ restored: string[] }>(propertyId, {
    method: 'POST',
    body: { action: 'restore', ids },
  });
  return data.restored ?? [];
}

// ── Library ────────────────────────────────────────────────────────────────

export type MarketingLibrarySort = 'updated' | 'name' | 'created';

export type MarketingLibraryItem = {
  id: string;
  name: string;
  kind: MarketingItemKind;
  contentType: MarketingContentType;
  platform: string | null;
  aspectPreset: string | null;
  themeKey: string | null;
  groupId: string | null;
  sourceTemplateId: string | null;
  thumbnailUrl: string | null;
  aiGenerated: boolean;
  isCollage: boolean;
  themeHash: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  groupSize: number;
  groupMembers: Array<{ id: string; aspectPreset: string | null; updatedAt: string }>;
  /** Calendars without a stored thumbnail: their styles, for the SVG card art. */
  previewStyles?: Record<string, unknown> | null;
};

export type MarketingLibraryFilters = {
  contentType: MarketingContentType;
  kind?: MarketingItemKind;
  /** Null = every theme. */
  themeKey: string | null;
  query?: string;
  size?: string | null;
  sort?: MarketingLibrarySort;
  deleted?: boolean;
  limit?: number;
};

export type MarketingLibraryPage = { items: MarketingLibraryItem[]; nextCursor: string | null };

export function libraryQueryParams(
  filters: MarketingLibraryFilters,
  cursor: string | null
): URLSearchParams {
  const params = new URLSearchParams({ view: 'library', content_type: filters.contentType });
  if (filters.kind && filters.kind !== 'design') params.set('kind', filters.kind);
  if (filters.themeKey) params.set('theme_key', filters.themeKey);
  const query = filters.query?.trim();
  if (query) params.set('q', query);
  if (filters.size) params.set('size', filters.size);
  if (filters.sort && filters.sort !== 'updated') params.set('sort', filters.sort);
  if (filters.deleted) params.set('deleted', '1');
  if (filters.limit) params.set('limit', String(filters.limit));
  if (cursor) params.set('cursor', cursor);
  return params;
}

export async function fetchMarketingLibraryPage(
  propertyId: string | null,
  filters: MarketingLibraryFilters,
  cursor: string | null
): Promise<MarketingLibraryPage> {
  const data = await edgeRequest<MarketingLibraryPage>(propertyId, {
    query: libraryQueryParams(filters, cursor),
  });
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

export type MarketingTemplateUsage = {
  sourceTemplateId: string;
  count: number;
  latestId: string;
  latestName: string;
  latestAspectPreset: string | null;
  latestUpdatedAt: string;
};

export async function fetchMarketingTemplateUsage(
  propertyId: string | null,
  contentType: MarketingContentType,
  themeKey: string | null
): Promise<MarketingTemplateUsage[]> {
  const params = new URLSearchParams({ view: 'usage', content_type: contentType });
  if (themeKey) params.set('theme_key', themeKey);
  const data = await edgeRequest<{ usage: MarketingTemplateUsage[] }>(propertyId, {
    query: params,
  });
  return data.usage ?? [];
}

// ── Query keys + cache helpers ─────────────────────────────────────────────

export const marketingTemplateKeys = {
  all: (propertyId: string | null) => ['marketing-templates', propertyId] as const,
  legacyList: (propertyId: string | null, contentType?: MarketingContentType) =>
    ['marketing-templates', propertyId, contentType] as const,
  library: (propertyId: string | null) => ['marketing-templates', propertyId, 'library'] as const,
  libraryPage: (propertyId: string | null, filters: MarketingLibraryFilters) =>
    ['marketing-templates', propertyId, 'library', filters] as const,
  usage: (propertyId: string | null, contentType: MarketingContentType, themeKey: string | null) =>
    ['marketing-templates', propertyId, 'usage', contentType, themeKey] as const,
  item: (propertyId: string | null, id: string) =>
    ['marketing-templates', propertyId, 'item', id] as const,
  showcase: (propertyId: string | null) =>
    ['marketing-templates', propertyId, 'library', 'showcase'] as const,
};

/**
 * After a write: refresh Library pages and usage; mark the heavy legacy lists stale
 * without refetching (autosave runs every few seconds, they reload on next use).
 */
export function invalidateMarketingLibrary(
  queryClient: QueryClient,
  propertyId: string | null
): void {
  void queryClient.invalidateQueries({ queryKey: marketingTemplateKeys.library(propertyId) });
  void queryClient.invalidateQueries({
    queryKey: ['marketing-templates', propertyId, 'usage'],
  });
  void queryClient.invalidateQueries({
    queryKey: marketingTemplateKeys.all(propertyId),
    refetchType: 'none',
  });
}

/** Legacy full list (theme cards, assistant context). The editors use item / library queries. */
export function useMarketingTemplates(contentType?: MarketingContentType) {
  const propertyId = usePropertyIdParam();

  return useQuery({
    queryKey: marketingTemplateKeys.legacyList(propertyId, contentType),
    queryFn: async () => {
      const templates = await fetchMarketingTemplates(propertyId);
      return contentType ? templates.filter((t) => t.contentType === contentType) : templates;
    },
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useSaveMarketingTemplate() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveMarketingTemplatePayload) =>
      saveMarketingTemplate(propertyId, payload),
    onSuccess: () => invalidateMarketingLibrary(queryClient, propertyId),
    onError: (error: Error) => toast.error(error.message || 'Save failed'),
  });
}

export function useUpdateMarketingTemplate() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateMarketingTemplatePayload) =>
      updateMarketingTemplate(propertyId, payload),
    onSuccess: () => invalidateMarketingLibrary(queryClient, propertyId),
    onError: (error: Error) => toast.error(error.message || 'Update failed'),
  });
}
