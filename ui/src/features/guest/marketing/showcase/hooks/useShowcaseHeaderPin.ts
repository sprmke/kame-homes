import { useLayoutEffect, useState, type CSSProperties } from 'react';

import {
  observeShowcaseFrameRect,
  readShowcaseScopeTheme,
  resolveShowcaseChromeHost,
  resolveShowcaseScrollRoot,
  type ShowcaseScopeThemeSnapshot,
} from '@/features/guest/marketing/showcase/lib/showcaseScroll';

const HEADER_Z = 90;

export type ShowcaseHeaderPin = {
  style: CSSProperties;
  theme: ShowcaseScopeThemeSnapshot | null;
  /**
   * Page Editor: chrome host beside the scrollport.
   * Embed (no host): `null` with fixed frame rect → caller uses `document.body`.
   * Live: `null` → `document.body`.
   */
  portalTarget: HTMLElement | null;
};

function framePinStyle(rect: DOMRectReadOnly): CSSProperties {
  return {
    position: 'fixed',
    top: rect.top,
    left: rect.left,
    width: rect.width,
    zIndex: HEADER_Z,
  };
}

const CHROME_HOST_PIN_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: HEADER_Z,
  pointerEvents: 'auto',
};

/**
 * Pin the showcase / stay-guide header with `position: fixed` / absolute so Admin
 * PageTransition transforms, `@container` layout containment, and warm-tint
 * `filter` cannot trap sticky against a scrolling ancestor.
 *
 * Live → viewport, portaled to `document.body`.
 * Page Editor → absolute in `[data-page-editor-preview-chrome]` (clips to frame,
 * stays under admin sheets).
 * Embed without chrome host → fixed to frame rect on `document.body`.
 */
export function useShowcaseHeaderPin(options: {
  enabled: boolean;
  containedChrome: boolean;
  embed: boolean;
}): ShowcaseHeaderPin | null {
  const needsFrame = options.containedChrome || options.embed;
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [chromeHost, setChromeHost] = useState<HTMLElement | null>(null);
  const [style, setStyle] = useState<CSSProperties | null>(() =>
    options.enabled && !needsFrame
      ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: HEADER_Z }
      : null
  );
  const [theme, setTheme] = useState<ShowcaseScopeThemeSnapshot | null>(null);

  useLayoutEffect(() => {
    if (!options.enabled) {
      setScrollRoot(null);
      setChromeHost(null);
      return;
    }
    if (!needsFrame) {
      setScrollRoot(null);
      setChromeHost(null);
      return;
    }

    let cancelled = false;
    let rafId = 0;
    const bind = () => {
      if (cancelled) return;
      const root = resolveShowcaseScrollRoot({
        embed: options.embed,
        containedChrome: options.containedChrome,
      });
      if (!root) {
        rafId = requestAnimationFrame(bind);
        return;
      }
      setScrollRoot(root);
      setChromeHost(resolveShowcaseChromeHost(root));
    };
    bind();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [options.enabled, needsFrame, options.containedChrome, options.embed]);

  useLayoutEffect(() => {
    if (!options.enabled) {
      setStyle(null);
      setTheme(null);
      return;
    }

    const syncTheme = () => {
      setTheme(readShowcaseScopeTheme());
    };

    if (!needsFrame) {
      setStyle({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: HEADER_Z,
      });
      syncTheme();
      return;
    }

    if (!scrollRoot) {
      setStyle(null);
      return;
    }

    syncTheme();

    // Page Editor chrome host: absolute pin — host does not scroll.
    if (chromeHost) {
      setStyle(CHROME_HOST_PIN_STYLE);
      return;
    }

    // Embed / legacy contained: fixed to the visible frame rect on body.
    return observeShowcaseFrameRect(scrollRoot, (rect) => {
      setStyle(framePinStyle(rect));
    });
  }, [options.enabled, needsFrame, scrollRoot, chromeHost]);

  if (!options.enabled || !style) return null;
  return {
    style,
    theme,
    portalTarget: chromeHost,
  };
}
