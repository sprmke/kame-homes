import { useEffect, useRef, useState } from 'react';

import { marketingLowSpecMode } from '@/features/dashboard/marketing/lib/marketingDeviceTier';
import {
  findStoredPresetThumb,
  loadPresetThumb,
  peekPresetThumb,
  presetThumbCacheKey,
  type PresetThumbRequest,
} from '@/features/dashboard/marketing/lib/marketingPresetThumbs';

type Options = {
  /** The card is on (or near) screen. Nothing loads before this. */
  visible: boolean;
  /** The host points at / focuses the card: low-spec devices render only then. */
  intent?: boolean;
};

/**
 * Art for one built-in template card. Stored art shows as soon as the card is visible;
 * a fresh render runs only when needed and (on low-spec devices) only on intent.
 */
export function usePresetThumbnail(request: PresetThumbRequest | null, options: Options) {
  const key = request ? presetThumbCacheKey(request) : null;
  const [state, setState] = useState<{ key: string | null; url: string | null; loading: boolean }>(
    () => ({ key, url: request ? (peekPresetThumb(request) ?? null) : null, loading: false })
  );
  const requestRef = useRef(request);
  requestRef.current = request;

  // Key changed (theme edit, size switch): start from the memory cache again.
  useEffect(() => {
    const current = requestRef.current;
    setState({ key, url: current ? (peekPresetThumb(current) ?? null) : null, loading: false });
  }, [key]);

  const wantsRender = options.visible && (!marketingLowSpecMode() || Boolean(options.intent));

  useEffect(() => {
    const current = requestRef.current;
    if (!current || !key || !options.visible) return;
    let cancelled = false;

    void (async () => {
      const stored = await findStoredPresetThumb(current);
      if (cancelled) return;
      if (stored) {
        setState({ key, url: stored, loading: false });
        return;
      }
      if (!wantsRender) return;
      setState((prev) => (prev.key === key ? { ...prev, loading: true } : prev));
      const url = await loadPresetThumb(current);
      if (cancelled) return;
      setState({ key, url, loading: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [key, options.visible, wantsRender]);

  const fresh = state.key === key;
  return { url: fresh ? state.url : null, loading: fresh && state.loading };
}

/** Fire once a node enters (or nears) the viewport. */
export function useNearViewport<T extends Element>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return { ref, visible };
}
