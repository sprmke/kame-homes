import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Breathing room between brand ↔ nav and nav ↔ actions. */
const MIN_GAP_PX = 28;
/** Theme toggle hit target — always present in the actions cluster. */
const THEME_TOGGLE_PX = 44;
/** Extra slack so we collapse before the row packs tight / truncates the name. */
const COMFORT_SLACK_PX = 40;
/** Hysteresis so collapsing to hamburger (which adds ~44px) does not immediately re-expand. */
const EXPAND_HYSTERESIS_PX = 56;

type Options = {
  /** Page Editor mobile preview — always hamburger. */
  forceMobile: boolean;
  /** Remeasure when labels / brand title change. */
  navKey: string;
};

/** Intrinsic brand width (logo + title), not the flex-stretched `w-full` button box. */
function measureBrandContentWidth(brand: HTMLElement): number {
  const btn = brand.querySelector('button');
  if (!btn) return brand.scrollWidth;

  const styles = getComputedStyle(btn);
  const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 10;
  const children = Array.from(btn.children) as HTMLElement[];
  if (children.length === 0) return btn.scrollWidth;

  let width = 0;
  children.forEach((child, index) => {
    // Title may use truncate — scrollWidth is the full untruncated text width we need.
    width += child.scrollWidth;
    if (index > 0) width += gap;
  });
  return width;
}

/**
 * Collapses showcase / stay-guide header section links to the hamburger when
 * the full property name + inline nav + actions would not fit with comfortable
 * gaps. Prefer hamburger over ellipsizing the brand title.
 */
export function useShowcaseCompactHeaderNav({ forceMobile, navKey }: Options): {
  compact: boolean;
  rowRef: RefObject<HTMLDivElement | null>;
  brandRef: RefObject<HTMLDivElement | null>;
  probeRef: RefObject<HTMLElement | null>;
} {
  const rowRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLElement>(null);
  // Start compact to avoid a flash of overlapping links, then expand on measure.
  const [compact, setCompact] = useState(true);

  useLayoutEffect(() => {
    if (forceMobile) {
      setCompact(true);
      return;
    }

    const row = rowRef.current;
    const brand = brandRef.current;
    const probe = probeRef.current;
    if (!row || !brand || !probe) {
      setCompact(true);
      return;
    }

    const measure = () => {
      const rowW = row.clientWidth;
      if (rowW <= 0) {
        setCompact(true);
        return;
      }

      // Full brand (untruncated name) — never under-count so nav stays while title ellipsizes.
      const brandUsed = measureBrandContentWidth(brand);
      const available = rowW - brandUsed - THEME_TOGGLE_PX - MIN_GAP_PX * 2;
      const navW = probe.scrollWidth;
      const comfortBudget = available - COMFORT_SLACK_PX;

      setCompact((prev) => {
        if (comfortBudget < 0) return true;
        if (prev) {
          // Expand once nav fits with room to spare (hamburger will leave the row).
          return navW > comfortBudget - EXPAND_HYSTERESIS_PX;
        }
        return navW > comfortBudget;
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    ro.observe(brand);
    ro.observe(probe);
    return () => ro.disconnect();
  }, [forceMobile, navKey]);

  return { compact, rowRef, brandRef, probeRef };
}
