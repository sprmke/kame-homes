/**
 * Built-in post / video template card art (headless Polotno / Remotion stills).
 *
 * Order of lookup: memory LRU → IndexedDB (per theme) → render. Renders share the one
 * global render slot (`withGlobalRenderSlot`), which also waits while the host works on
 * a canvas. Requests for the same key share one promise.
 */

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  DEFAULT_MARKETING_THUMB_BINDING,
  resolveMarketingThumbBinding,
} from '@/features/dashboard/marketing/lib/marketingDefaultBinding';
import {
  getPersistedPresetThumbnail,
  setPersistedPresetThumbnail,
} from '@/features/dashboard/marketing/lib/marketingPresetThumbnailStore';
import {
  designPresetThumbnailKey,
  getCachedMarketingThumbnail,
  marketingBindingCacheKey,
  setCachedMarketingThumbnail,
  videoPresetThumbnailKey,
} from '@/features/dashboard/marketing/lib/marketingTemplateThumbnailCache';
import { withGlobalRenderSlot } from '@/features/dashboard/marketing/lib/marketingThumbnailQueue';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import type {
  VideoFormat,
  VideoProject,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export type PresetThumbRequest =
  | {
      contentType: 'design';
      /** Concrete per-size preset id (`promo-500-off-instagram-story`). */
      presetId: string;
      theme: MarketingThemeTokens;
      themeHash: string;
    }
  | {
      contentType: 'video';
      presetId: string;
      size: VideoFormat;
      theme: MarketingThemeTokens;
      themeHash: string;
      binding?: DesignBinding;
    };

export function presetThumbCacheKey(request: PresetThumbRequest): string {
  if (request.contentType === 'design') {
    return designPresetThumbnailKey(request.presetId, undefined, request.themeHash);
  }
  const bindingKey = marketingBindingCacheKey(resolveMarketingThumbBinding(request.binding));
  return videoPresetThumbnailKey(
    request.presetId,
    request.size,
    undefined,
    bindingKey,
    request.themeHash
  );
}

function persistKey(request: PresetThumbRequest, cacheKey: string): string {
  return `${request.contentType}:${cacheKey}`;
}

const inFlight = new Map<string, Promise<string | null>>();

/** Memory hit only (synchronous, for first paint). */
export function peekPresetThumb(request: PresetThumbRequest): string | undefined {
  return getCachedMarketingThumbnail(presetThumbCacheKey(request));
}

/** Memory or IndexedDB, never renders. */
export async function findStoredPresetThumb(
  request: PresetThumbRequest
): Promise<string | undefined> {
  const cacheKey = presetThumbCacheKey(request);
  const memory = getCachedMarketingThumbnail(cacheKey);
  if (memory) return memory;
  const stored = await getPersistedPresetThumbnail(persistKey(request, cacheKey));
  if (stored) setCachedMarketingThumbnail(cacheKey, stored);
  return stored;
}

async function render(request: PresetThumbRequest): Promise<string | null> {
  if (request.contentType === 'design') {
    const { renderDesignPresetThumbnail } =
      await import('@/features/dashboard/marketing/lib/renderMarketingDesignThumbnail');
    return renderDesignPresetThumbnail(
      request.presetId,
      DEFAULT_MARKETING_THUMB_BINDING,
      undefined,
      request.theme
    );
  }
  const { renderVideoPresetThumbnail } =
    await import('@/features/dashboard/marketing/lib/renderMarketingVideoThumbnail');
  return renderVideoPresetThumbnail(
    request.presetId,
    request.size,
    resolveMarketingThumbBinding(request.binding),
    undefined,
    request.theme
  );
}

/** Stored art, or a fresh render in the shared slot. Null when rendering failed. */
export function loadPresetThumb(request: PresetThumbRequest): Promise<string | null> {
  const cacheKey = presetThumbCacheKey(request);
  const memory = getCachedMarketingThumbnail(cacheKey);
  if (memory) return Promise.resolve(memory);
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const job = (async () => {
    const stored = await findStoredPresetThumb(request);
    if (stored) return stored;
    const dataUrl = await withGlobalRenderSlot(async () => {
      // Another card may have rendered it while this one waited for the slot.
      const again = getCachedMarketingThumbnail(cacheKey);
      if (again) return again;
      if (typeof document !== 'undefined' && document.hidden) return null;
      return render(request).catch(() => null);
    });
    if (dataUrl) {
      setCachedMarketingThumbnail(cacheKey, dataUrl);
      void setPersistedPresetThumbnail(persistKey(request, cacheKey), dataUrl);
    }
    return dataUrl;
  })().finally(() => {
    inFlight.delete(cacheKey);
  });

  inFlight.set(cacheKey, job);
  return job;
}

/** Still of a video project (first clip) for its stored Library thumbnail. */
export async function captureVideoProjectThumbnail(
  project: VideoProject,
  brandColor?: string,
  theme?: MarketingThemeTokens | null
): Promise<string | null> {
  const { renderVideoProjectThumbnail } = await import(
    '@/features/dashboard/marketing/lib/renderMarketingVideoThumbnail'
  );
  return renderVideoProjectThumbnail(project, brandColor, theme);
}
