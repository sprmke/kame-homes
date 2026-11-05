import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAiPosterEngine } from '@/features/dashboard/marketing/hooks/useAiPosterEngine';
import {
  postSampleCacheKey,
  postSampleFacts,
  showcaseFacts,
  type PostSample,
} from '@/features/dashboard/marketing/lib/aiStudioSamples';
import { waitForMarketingIdle } from '@/features/dashboard/marketing/lib/marketingIdle';
import {
  getPersistedPresetThumbnail,
  setPersistedPresetThumbnail,
} from '@/features/dashboard/marketing/lib/marketingPresetThumbnailStore';
import { withGlobalRenderSlot } from '@/features/dashboard/marketing/lib/marketingThumbnailQueue';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

/** In-memory copy for this tab, so reopening the gallery never redraws. */
const memoryCache = new Map<string, string>();

export type PostSampleRenderer = {
  /** Property data has loaded; plans below are final. */
  ready: boolean;
  /** How this example would be drawn, or null when it should stay hidden. */
  planFor: (sample: PostSample) => { key: string; showcase: boolean } | null;
  /** Draws (or reads the cache for) one example; resolves to an image data URL. */
  render: (sample: PostSample) => Promise<{ dataUrl: string; showcase: boolean }>;
};

/**
 * Live post examples: each one is a rule-based post in the example's layout, drawn
 * with the host's own listing, photos and theme (no AI call). With no listing photos,
 * or if the host's photos cannot be drawn, it uses the stand-in showcase listing.
 */
export function useAiStudioPostSampleRenderer(): PostSampleRenderer {
  const engine = useAiPosterEngine();
  const propertyId = usePropertyIdParam();
  const showcase = useMemo(
    () => showcaseFacts(typeof window === 'undefined' ? '' : window.location.origin),
    []
  );

  const planFor = useCallback(
    (sample: PostSample) => {
      const plan = postSampleFacts(sample, engine.baseFacts, showcase);
      if (!plan) return null;
      return {
        showcase: plan.showcase,
        key: postSampleCacheKey({
          propertyId,
          sampleId: sample.id,
          themeKey: engine.themeKey,
          facts: plan.facts,
        }),
      };
    },
    [engine.baseFacts, engine.themeKey, propertyId, showcase]
  );

  const { renderSample, baseFacts, themeKey } = engine;
  const render = useCallback(
    async (sample: PostSample) => {
      const plan = postSampleFacts(sample, baseFacts, showcase);
      if (!plan) throw new Error('This example needs details the listing does not have');

      const draw = async (facts: typeof plan.facts, isShowcase: boolean) => {
        const key = postSampleCacheKey({ propertyId, sampleId: sample.id, themeKey, facts });
        const cached = memoryCache.get(key) ?? (await getPersistedPresetThumbnail(key));
        if (cached) {
          memoryCache.set(key, cached);
          return { dataUrl: cached, showcase: isShowcase };
        }
        const dataUrl = await withGlobalRenderSlot(() =>
          renderSample({
            goal: sample.goal,
            archetype: sample.archetype,
            format: sample.format,
            facts,
          })
        );
        memoryCache.set(key, dataUrl);
        void setPersistedPresetThumbnail(key, dataUrl).catch(() => undefined);
        return { dataUrl, showcase: isShowcase };
      };

      try {
        return await draw(plan.facts, plan.showcase);
      } catch (error) {
        // The host's photos could not be drawn (blocked host, deleted file): show the
        // layout with the stand-in listing rather than an empty card.
        if (plan.showcase) throw error;
        return draw(showcase, true);
      }
    },
    [baseFacts, showcase, propertyId, themeKey, renderSample]
  );

  return useMemo(() => ({ ready: engine.ready, planFor, render }), [engine.ready, planFor, render]);
}

export type PostSampleImage =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; dataUrl: string; showcase: boolean }
  | { status: 'error' };

/** One example's preview, drawn when `enabled` (e.g. once the card is near the viewport). */
export function usePostSampleImage(
  sample: PostSample | null,
  renderer: PostSampleRenderer,
  enabled: boolean
): PostSampleImage {
  const [state, setState] = useState<PostSampleImage>({ status: 'idle' });
  const plan = sample && renderer.ready ? renderer.planFor(sample) : null;
  const key = plan?.key ?? null;

  useEffect(() => {
    if (!sample || !key || !enabled) return;
    const hit = memoryCache.get(key);
    if (hit) {
      setState({ status: 'ready', dataUrl: hit, showcase: plan?.showcase ?? false });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    // A card entering the viewport on first paint must not compete with LCP/TBT for
    // the heavy Konva/Polotno render it triggers — defer the kick-off to idle time.
    void waitForMarketingIdle().then(() => {
      if (cancelled) return;
      renderer
        .render(sample)
        .then((result) => {
          if (!cancelled) setState({ status: 'ready', ...result });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'error' });
        });
    });
    return () => {
      cancelled = true;
    };
    // `renderer.render` changes with the same inputs that change `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample?.id, key, enabled]);

  return state;
}
