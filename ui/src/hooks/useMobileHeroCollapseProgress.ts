import { useEffect, useState, type RefObject } from 'react';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

/** Scroll distance (px) over which the hero fully collapses. */
export const MOBILE_HERO_COLLAPSE_DISTANCE_PX = 88;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function isScrollableY(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return false;
  return el.scrollHeight > el.clientHeight + 1;
}

/**
 * Prefer an inner content scrollport (`data-admin-content-scroll`) when present
 * and actually scrollable (e.g. Inbox / Settings fill-main). Else the nearest
 * scrollable ancestor (usually `main`).
 */
export function resolveMobileHeroScrollTarget(from: HTMLElement | null): HTMLElement | null {
  if (!from || typeof document === 'undefined') return null;

  const pageRoot = from.closest('[data-admin-mobile-page]');
  if (pageRoot) {
    const scoped = pageRoot.querySelectorAll<HTMLElement>('[data-admin-content-scroll]');
    for (const el of scoped) {
      if (isScrollableY(el)) return el;
    }
  }

  let node: HTMLElement | null = from.parentElement;
  while (node) {
    if (isScrollableY(node)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * 0 = expanded brand hero, 1 = title + bottom pad fully compressed (parallax).
 * Driven by the active scrollport (`main` after sticky/fillMain was removed);
 * respects prefers-reduced-motion (binary snap).
 */
export function useMobileHeroCollapseProgress(
  heroRef: RefObject<HTMLElement | null>,
  enabled = true
): number {
  const reducedMotion = usePrefersReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setProgress(0);
      return;
    }

    const hero = heroRef.current;
    if (!hero) return;

    let frame = 0;
    let target: HTMLElement | null = null;

    const readProgress = () => {
      const scrollTop = target?.scrollTop ?? 0;
      const next = clamp01(scrollTop / MOBILE_HERO_COLLAPSE_DISTANCE_PX);
      setProgress((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (reducedMotion) {
          const scrollTop = target?.scrollTop ?? 0;
          setProgress(scrollTop > MOBILE_HERO_COLLAPSE_DISTANCE_PX * 0.35 ? 1 : 0);
          return;
        }
        readProgress();
      });
    };

    const bind = () => {
      const nextTarget = resolveMobileHeroScrollTarget(hero);
      if (nextTarget === target) return;
      target?.removeEventListener('scroll', onScroll);
      target = nextTarget;
      target?.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    };

    bind();
    const ro = new ResizeObserver(() => bind());
    const pageRoot = hero.closest('[data-admin-mobile-page]');
    if (pageRoot) ro.observe(pageRoot);
    ro.observe(hero);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      target?.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [enabled, heroRef, reducedMotion]);

  return progress;
}
