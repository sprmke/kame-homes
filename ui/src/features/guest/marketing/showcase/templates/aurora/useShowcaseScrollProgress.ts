import { useLayoutEffect, type RefObject } from 'react';

import { useMotionValue, useSpring, type MotionValue, type SpringOptions } from 'framer-motion';

import { resolveShowcaseScrollRoot } from '@/features/guest/marketing/showcase/lib/showcaseScroll';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Matches Framer offset `['start start', 'end start']` for hero parallax. */
function measureHeroScrollProgress(target: HTMLElement, scrollRoot: HTMLElement | null): number {
  const rootTop = scrollRoot ? scrollRoot.getBoundingClientRect().top : 0;
  const targetRect = target.getBoundingClientRect();
  const range = target.offsetHeight || targetRect.height;
  if (range < 1) return 0;
  const start = targetRect.top - rootTop;
  return clamp01(-start / range);
}

/** Matches Framer offset `['start end', 'end start']` for section parallax. */
function measureSectionScrollProgress(target: HTMLElement, scrollRoot: HTMLElement | null): number {
  const rootTop = scrollRoot ? scrollRoot.getBoundingClientRect().top : 0;
  const rootHeight = scrollRoot ? scrollRoot.clientHeight : window.innerHeight;
  const rootBottom = rootTop + rootHeight;
  const targetRect = target.getBoundingClientRect();
  const span = rootHeight + targetRect.height;
  if (span < 1) return 0;
  return clamp01((rootBottom - targetRect.top) / span);
}

/**
 * Matches Framer offset `['start start', 'end end']` for pinned horizontal galleries.
 * Progress 0 when the section top hits the scrollport top; 1 when the section bottom
 * hits the scrollport bottom (sticky viewport has finished scrubbing the track).
 */
function measurePinScrollProgress(target: HTMLElement, scrollRoot: HTMLElement | null): number {
  const rootTop = scrollRoot ? scrollRoot.getBoundingClientRect().top : 0;
  const rootHeight = scrollRoot ? scrollRoot.clientHeight : window.innerHeight;
  const targetRect = target.getBoundingClientRect();
  const range = (target.offsetHeight || targetRect.height) - rootHeight;
  if (range < 1) return 0;
  const start = targetRect.top - rootTop;
  return clamp01(-start / range);
}

type ScrollProgressMode = 'hero' | 'section' | 'pin';

/**
 * Scroll progress wired to the real scrollport (Page Editor preview, embed root, or window).
 * Framer `useScroll` defaults to the window and misses nested preview scrollers.
 */
export function useShowcaseScrollProgress(
  targetRef: RefObject<HTMLElement | null>,
  options: {
    mode: ScrollProgressMode;
    embed: boolean;
    contained: boolean;
    enabled: boolean;
    spring: SpringOptions;
    /** When false, return the raw motion value (no spring smoothing). Default true. */
    smooth?: boolean;
  }
): MotionValue<number> {
  const raw = useMotionValue(0);
  const smooth = useSpring(raw, options.spring);
  const useSmooth = options.smooth !== false;

  useLayoutEffect(() => {
    if (!options.enabled) {
      raw.set(0);
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let scrollTarget: HTMLElement | Window | null = null;
    let usesDocumentScroll = false;
    let resizeObserver: ResizeObserver | null = null;

    const measure = () => {
      if (cancelled) return;
      const target = targetRef.current;
      if (!target) return;

      const scrollRoot = resolveShowcaseScrollRoot({
        embed: options.embed,
        containedChrome: options.contained,
        anchor: target,
      });

      const value =
        options.mode === 'hero'
          ? measureHeroScrollProgress(target, scrollRoot)
          : options.mode === 'pin'
            ? measurePinScrollProgress(target, scrollRoot)
            : measureSectionScrollProgress(target, scrollRoot);
      raw.set(value);
    };

    const bind = () => {
      if (cancelled) return;
      const target = targetRef.current;
      if (!target) {
        rafId = requestAnimationFrame(bind);
        return;
      }

      const scrollRoot = resolveShowcaseScrollRoot({
        embed: options.embed,
        containedChrome: options.contained,
        anchor: target,
      });

      scrollTarget = scrollRoot ?? window;
      usesDocumentScroll = !scrollRoot;
      scrollTarget.addEventListener('scroll', measure, { passive: true });
      if (usesDocumentScroll) {
        document.addEventListener('scroll', measure, { passive: true });
      }
      window.addEventListener('resize', measure, { passive: true });
      window.visualViewport?.addEventListener('resize', measure);
      window.visualViewport?.addEventListener('scroll', measure);

      resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
              measure();
            })
          : null;
      resizeObserver?.observe(target);
      if (scrollRoot) resizeObserver?.observe(scrollRoot);

      measure();
    };

    bind();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      scrollTarget?.removeEventListener('scroll', measure);
      if (usesDocumentScroll) {
        document.removeEventListener('scroll', measure);
      }
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
      resizeObserver?.disconnect();
    };
  }, [options.contained, options.embed, options.enabled, options.mode, raw, targetRef]);

  if (!options.enabled) return raw;
  return useSmooth ? smooth : raw;
}
