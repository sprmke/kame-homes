import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MarketingTemplateRecord } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  DEFAULT_MARKETING_THUMB_BINDING,
  resolveMarketingThumbBinding,
} from '@/features/dashboard/marketing/lib/marketingDefaultBinding';
import {
  waitForMarketingIdle,
  yieldToMainThread,
} from '@/features/dashboard/marketing/lib/marketingIdle';
import {
  getManyPersistedPresetThumbnails,
  setPersistedPresetThumbnail,
} from '@/features/dashboard/marketing/lib/marketingPresetThumbnailStore';
import {
  designPresetThumbnailKey,
  getCachedMarketingThumbnail,
  marketingBindingCacheKey,
  savedDesignThumbnailKey,
  savedVideoThumbnailKey,
  setCachedMarketingThumbnail,
  subscribeMarketingThumbnailUpdates,
  videoPresetThumbnailKey,
} from '@/features/dashboard/marketing/lib/marketingTemplateThumbnailCache';
import {
  marketingThemeHash,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { runWithConcurrency } from '@/features/dashboard/marketing/lib/marketingThumbnailQueue';
import { rethemePolotnoDocument } from '@/features/dashboard/marketing/lib/theme/designThemeAdapter';
import { readTemplateThemeSnapshot } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import { parseVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';
import type {
  VideoFormat,
  VideoProject,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { getVideoCampaignTemplate } from '@/features/dashboard/marketing/lib/videoCampaignTemplates';

type DesignOptions = {
  contentType: 'design';
  presetIds: string[];
  brandColor?: string;
  /** Active marketing theme: presets render in it and cache per theme. */
  theme?: MarketingThemeTokens | null;
  savedRecords?: MarketingTemplateRecord[];
};

type VideoOptions = {
  contentType: 'video';
  presetIds: string[];
  format: VideoFormat;
  brandColor?: string;
  theme?: MarketingThemeTokens | null;
  binding?: DesignBinding;
  savedRecords?: MarketingTemplateRecord[];
};

/**
 * Calendar cards no longer use captured images: they render the live calendar DOM
 * (`CalendarLayoutLivePreview`), which is cheaper and always in the current theme.
 */
type Options = DesignOptions | VideoOptions;

/**
 * Renderers load on demand: OpenPolotno and Remotion are big, and this hook is
 * shared by the Posts and Videos editors. Static imports here pulled both
 * libraries into one shared, precached chunk; lazy loading keeps them in their
 * own chunks, fetched only when a thumbnail actually renders.
 */
const loadDesignRenderer = () =>
  import('@/features/dashboard/marketing/lib/renderMarketingDesignThumbnail');
const loadVideoRenderer = () =>
  import('@/features/dashboard/marketing/lib/renderMarketingVideoThumbnail');

/** Remotion / Polotno captures are heavy — keep to one at a time. */
const PRESET_RENDER_CONCURRENCY = 1;

function savedRecordThumbnail(record: MarketingTemplateRecord): string | undefined {
  const value = record.designJson.thumbnailDataUrl;
  return typeof value === 'string' && value.startsWith('data:') ? value : undefined;
}

/**
 * The stored thumbnail shows another version of the theme, so re-render it.
 * Videos always draw in the current theme, so any hash mismatch is stale; posts
 * are only re-themed when they carry a snapshot (older posts keep their look).
 */
function savedThumbnailStale(
  record: MarketingTemplateRecord,
  themeHash: string | null
): boolean {
  if (!themeHash) return false;
  const savedHash =
    typeof record.designJson.themeHash === 'string' ? record.designJson.themeHash : null;
  if (record.contentType === 'video') return savedHash !== themeHash;
  return savedHash !== null && savedHash !== themeHash;
}

function presetPersistKey(contentType: Options['contentType'], cacheKey: string): string {
  return `${contentType}:${cacheKey}`;
}

function normalizeThumbnailRequestId(id: string): string {
  return id.replace(/^preset:/, '');
}

function isThumbnailRequested(id: string, requested: Set<string>): boolean {
  const bare = normalizeThumbnailRequestId(id);
  return requested.has(id) || requested.has(bare) || requested.has(`preset:${bare}`);
}

function mergePresetThumbnails(
  prev: Record<string, string>,
  presetIds: string[],
  next: Record<string, string>
): Record<string, string> {
  let changed = false;
  const merged = { ...prev };

  for (const [id, url] of Object.entries(next)) {
    if (merged[id] !== url) {
      merged[id] = url;
      changed = true;
    }
  }

  // Drop keys for the current preset set that were not re-hydrated.
  for (const id of presetIds) {
    if (!(id in next) && id in merged) {
      delete merged[id];
      changed = true;
    }
  }

  return changed ? merged : prev;
}

async function ensurePresetThumbnail(
  cacheKey: string,
  persistKey: string,
  render: () => Promise<string | null>
): Promise<string | null> {
  const cached = getCachedMarketingThumbnail(cacheKey);
  if (cached) return cached;

  const persisted = await getManyPersistedPresetThumbnails([persistKey]);
  const fromDb = persisted[persistKey];
  if (fromDb) {
    setCachedMarketingThumbnail(cacheKey, fromDb);
    return fromDb;
  }

  const dataUrl = await render();
  if (dataUrl) {
    setCachedMarketingThumbnail(cacheKey, dataUrl);
    void setPersistedPresetThumbnail(persistKey, dataUrl);
    return dataUrl;
  }
  return null;
}

export function useMarketingTemplateThumbnails(options: Options) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [hydrateVersion, setHydrateVersion] = useState(0);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set());
  const requestedIdsRef = useRef(requestedIds);
  requestedIdsRef.current = requestedIds;
  const thumbnailsRef = useRef(thumbnails);
  thumbnailsRef.current = thumbnails;
  const requestedKey = useMemo(() => [...requestedIds].sort().join('|'), [requestedIds]);

  const requestThumbnail = useCallback((id: string) => {
    const bare = normalizeThumbnailRequestId(id);
    setRequestedIds((prev) => {
      if (prev.has(id) || prev.has(bare) || prev.has(`preset:${bare}`)) return prev;
      const next = new Set(prev);
      next.add(id);
      next.add(bare);
      next.add(`preset:${bare}`);
      return next;
    });
  }, []);

  const requestThumbnails = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setRequestedIds((prev) => {
      let next: Set<string> | null = null;
      for (const id of ids) {
        const bare = normalizeThumbnailRequestId(id);
        if (prev.has(id) || prev.has(bare) || prev.has(`preset:${bare}`)) continue;
        if (!next) next = new Set(prev);
        next.add(id);
        next.add(bare);
        next.add(`preset:${bare}`);
      }
      return next ?? prev;
    });
  }, []);

  const contentType = options.contentType;
  const presetIds = options.presetIds;
  const videoFormat = options.contentType === 'video' ? options.format : undefined;
  const brandColor = options.brandColor;
  const theme = options.theme ?? null;
  const themeHash = useMemo(() => (theme ? marketingThemeHash(theme) : null), [theme]);
  const videoBinding = options.contentType === 'video' ? options.binding : undefined;

  const videoBindingKey = useMemo(() => {
    if (contentType !== 'video') return '';
    return marketingBindingCacheKey(resolveMarketingThumbBinding(videoBinding));
  }, [contentType, videoBinding]);

  const presetKey = useMemo(() => {
    const ids = presetIds.join(',');
    const look = themeHash ?? brandColor ?? '';
    if (contentType === 'video') return `${videoFormat}:${look}:${ids}`;
    return `${look}:${ids}`;
  }, [contentType, presetIds, videoFormat, brandColor, themeHash]);

  const savedRecords = useMemo(() => options.savedRecords ?? [], [options.savedRecords]);

  const savedKey = useMemo(
    () => savedRecords.map((record) => `${record.id}:${record.updatedAt}`).join(','),
    [savedRecords]
  );

  useEffect(() => {
    return subscribeMarketingThumbnailUpdates((templateId, dataUrl) => {
      setThumbnails((prev) =>
        prev[templateId] === dataUrl ? prev : { ...prev, [templateId]: dataUrl }
      );
    });
  }, [contentType]);

  useEffect(() => {
    let cancelled = false;

    const hydratePresets = async () => {
      if (presetIds.length === 0) return;

      const cacheKeys = presetIds.map((id) => {
        if (contentType === 'design') return designPresetThumbnailKey(id, brandColor, themeHash);
        return videoPresetThumbnailKey(id, videoFormat!, brandColor, videoBindingKey, themeHash);
      });

      const persistKeys = cacheKeys.map((key) => presetPersistKey(contentType, key));
      const next: Record<string, string> = {};

      for (let i = 0; i < presetIds.length; i += 1) {
        const id = presetIds[i]!;
        const cacheKey = cacheKeys[i]!;
        const memory = getCachedMarketingThumbnail(cacheKey);
        if (memory) next[id] = memory;
      }

      // Commit in-memory hits immediately (additive only — never drop existing
      // entries here) so flipping back to a previously viewed orientation/format
      // redisplays instantly instead of waiting on an IndexedDB round trip, while
      // leaving other presets' current thumbnails in place until they resolve.
      if (Object.keys(next).length > 0) {
        let changed = false;
        const memoryMerged = { ...thumbnailsRef.current };
        for (const [id, url] of Object.entries(next)) {
          if (memoryMerged[id] !== url) {
            memoryMerged[id] = url;
            changed = true;
          }
        }
        if (changed) {
          thumbnailsRef.current = memoryMerged;
          setThumbnails(memoryMerged);
        }
      }

      const persisted = await getManyPersistedPresetThumbnails(persistKeys);
      if (cancelled) return;

      for (let i = 0; i < presetIds.length; i += 1) {
        const id = presetIds[i]!;
        const cacheKey = cacheKeys[i]!;
        const persistKey = persistKeys[i]!;
        const fromDb = persisted[persistKey];
        if (fromDb) {
          setCachedMarketingThumbnail(cacheKey, fromDb);
          next[id] = fromDb;
        }
      }

      if (cancelled) return;

      const merged = mergePresetThumbnails(thumbnailsRef.current, presetIds, next);
      if (merged === thumbnailsRef.current) return;

      thumbnailsRef.current = merged;
      setThumbnails(merged);
      setHydrateVersion((version) => version + 1);
    };

    void hydratePresets();

    return () => {
      cancelled = true;
    };
  }, [
    contentType,
    presetKey,
    videoFormat,
    brandColor,
    themeHash,
    videoBindingKey,
    presetIds,
  ]);

  useEffect(() => {
    let cancelled = false;

    const renderMissingPresets = async () => {
      if (presetIds.length === 0) return;

      const current = thumbnailsRef.current;
      const missingIds = presetIds.filter((id) => !current[id]);
      const renderIds = missingIds.filter((id) =>
        isThumbnailRequested(id, requestedIdsRef.current)
      );

      if (renderIds.length === 0) return;

      await waitForMarketingIdle();
      if (cancelled || document.hidden) return;

      await runWithConcurrency(renderIds, PRESET_RENDER_CONCURRENCY, async (id) => {
        if (cancelled || document.hidden) return;
        await yieldToMainThread();
        if (cancelled) return;

        setLoadingIds((prev) => new Set(prev).add(id));

        let cacheKey: string;
        let dataUrl: string | null = null;

        try {
          if (contentType === 'design') {
            cacheKey = designPresetThumbnailKey(id, brandColor, themeHash);
            dataUrl = await ensurePresetThumbnail(
              cacheKey,
              presetPersistKey('design', cacheKey),
              () =>
                loadDesignRenderer().then(({ renderDesignPresetThumbnail }) =>
                  renderDesignPresetThumbnail(id, DEFAULT_MARKETING_THUMB_BINDING, brandColor, theme)
                )
            );
            if (!dataUrl && !cancelled) {
              await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
              const { renderDesignPresetThumbnail } = await loadDesignRenderer();
              dataUrl = await renderDesignPresetThumbnail(
                id,
                DEFAULT_MARKETING_THUMB_BINDING,
                brandColor,
                theme
              );
              if (dataUrl) {
                setCachedMarketingThumbnail(cacheKey, dataUrl);
                void setPersistedPresetThumbnail(presetPersistKey('design', cacheKey), dataUrl);
              }
            }
          } else {
            const thumbBinding = resolveMarketingThumbBinding(videoBinding);
            cacheKey = videoPresetThumbnailKey(
              id,
              videoFormat!,
              brandColor,
              videoBindingKey,
              themeHash
            );
            dataUrl = await ensurePresetThumbnail(
              cacheKey,
              presetPersistKey('video', cacheKey),
              () =>
                loadVideoRenderer().then(({ renderVideoPresetThumbnail }) =>
                  renderVideoPresetThumbnail(id, videoFormat!, thumbBinding, brandColor, theme)
                )
            );
            if (!dataUrl && !cancelled) {
              await new Promise<void>((resolve) => window.setTimeout(resolve, 400));
              const { renderVideoPresetThumbnail } = await loadVideoRenderer();
              dataUrl = await renderVideoPresetThumbnail(
                id,
                videoFormat!,
                thumbBinding,
                brandColor,
                theme
              );
              if (dataUrl) {
                setCachedMarketingThumbnail(cacheKey, dataUrl);
                void setPersistedPresetThumbnail(presetPersistKey('video', cacheKey), dataUrl);
              }
            }
          }

          if (cancelled) return;

          if (dataUrl) {
            setThumbnails((prev) => {
              if (prev[id] === dataUrl) return prev;
              return { ...prev, [id]: dataUrl! };
            });
          }
        } finally {
          setLoadingIds((prev) => {
            const copy = new Set(prev);
            copy.delete(id);
            return copy;
          });
        }
      });
    };

    void renderMissingPresets();

    return () => {
      cancelled = true;
    };
  }, [
    contentType,
    presetKey,
    requestedKey,
    hydrateVersion,
    videoFormat,
    brandColor,
    theme,
    themeHash,
    videoBindingKey,
    videoBinding,
    presetIds,
  ]);

  useEffect(() => {
    if (savedRecords.length === 0) return;

    let cancelled = false;

    const loadSaved = async () => {
      await runWithConcurrency(savedRecords, PRESET_RENDER_CONCURRENCY, async (record) => {
        if (cancelled) return;

        const stale = savedThumbnailStale(record, themeHash);
        const version = stale ? `${record.updatedAt}:${themeHash}` : record.updatedAt;
        const cacheKey =
          contentType === 'design'
            ? savedDesignThumbnailKey(record.id, version)
            : savedVideoThumbnailKey(record.id, version);

        const embedded = stale ? undefined : savedRecordThumbnail(record);
        if (embedded) {
          setCachedMarketingThumbnail(cacheKey, embedded);
          setThumbnails((prev) =>
            prev[record.id] === embedded ? prev : { ...prev, [record.id]: embedded }
          );
          return;
        }

        const cached = getCachedMarketingThumbnail(cacheKey);
        if (cached) {
          setThumbnails((prev) =>
            prev[record.id] === cached ? prev : { ...prev, [record.id]: cached }
          );
          return;
        }

        // Posts without a stale theme use the thumbnail captured at save time.
        if (contentType === 'design' && !stale) return;

        // Saved cards request `saved:<id>`; older callers used the bare id.
        const requested = requestedIdsRef.current;
        if (!isThumbnailRequested(record.id, requested) && !requested.has(`saved:${record.id}`)) {
          return;
        }
        await waitForMarketingIdle();
        if (cancelled || document.hidden) return;

        setLoadingIds((prev) => new Set(prev).add(record.id));

        let dataUrl: string | null = null;
        if (contentType === 'design' && theme) {
          const snapshot = readTemplateThemeSnapshot(record.designJson);
          const lockedIds = Array.isArray(record.designJson.lockedElementIds)
            ? record.designJson.lockedElementIds.filter(
                (id): id is string => typeof id === 'string'
              )
            : [];
          const document =
            snapshot.tokens && record.designJson.polotno
              ? rethemePolotnoDocument(record.designJson.polotno, snapshot.tokens, theme, lockedIds)
              : record.designJson.polotno;
          const { renderDesignDocumentThumbnail } = await loadDesignRenderer();
          dataUrl = await renderDesignDocumentThumbnail(document);
        } else if (contentType === 'video') {
          const template = getVideoCampaignTemplate(
            typeof record.designJson.templateId === 'string'
              ? record.designJson.templateId
              : record.id
          );
          const thumbBinding = resolveMarketingThumbBinding(videoBinding);
          const project = parseVideoProject(
            record.designJson.project ?? record.designJson,
            typeof record.designJson.templateId === 'string'
              ? record.designJson.templateId
              : 'quiet-morning',
            template?.category ?? 'soft-stay',
            thumbBinding,
            (typeof record.aspectPreset === 'string'
              ? record.aspectPreset
              : videoFormat!) as VideoFormat
          );
          const { renderVideoProjectThumbnail } = await loadVideoRenderer();
          dataUrl = await renderVideoProjectThumbnail(project, brandColor, theme);
        }

        if (cancelled) return;

        if (dataUrl) {
          setCachedMarketingThumbnail(cacheKey, dataUrl);
          setThumbnails((prev) =>
            prev[record.id] === dataUrl ? prev : { ...prev, [record.id]: dataUrl! }
          );
        }

        setLoadingIds((prev) => {
          const copy = new Set(prev);
          copy.delete(record.id);
          return copy;
        });
      });
    };

    void loadSaved();

    return () => {
      cancelled = true;
    };
  }, [
    contentType,
    savedKey,
    videoFormat,
    brandColor,
    theme,
    themeHash,
    videoBindingKey,
    videoBinding,
    requestedKey,
  ]);

  const getThumbnailUrl = (id: string) => {
    const bareId = id.replace(/^preset:/, '');
    return (
      thumbnails[id] ??
      thumbnails[bareId] ??
      (id.startsWith('preset:') ? undefined : thumbnails[`preset:${id}`])
    );
  };

  const isThumbnailLoading = (id: string) => {
    const bareId = id.replace(/^preset:/, '');
    return loadingIds.has(id) || loadingIds.has(bareId);
  };

  return { getThumbnailUrl, isThumbnailLoading, thumbnails, requestThumbnail, requestThumbnails };
}

export async function captureLiveVideoProjectThumbnail(
  project: VideoProject,
  brandColor?: string,
  theme?: MarketingThemeTokens | null
): Promise<string | null> {
  const { renderVideoProjectThumbnail } = await loadVideoRenderer();
  return renderVideoProjectThumbnail(project, brandColor, theme);
}
