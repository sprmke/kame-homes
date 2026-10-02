import { SHOWCASE_HEADER_SOLID_THRESHOLD_PX } from '@/features/guest/marketing/showcase/lib/showcaseScroll';

import { cn } from '@/lib/utils';

/** Portaled fixed header chrome height — keep in sync with SHOWCASE_HEADER_SOLID_THRESHOLD_PX (76). */
export const SHOWCASE_HEADER_CHROME_PX = SHOWCASE_HEADER_SOLID_THRESHOLD_PX;

/** Haven inset capsule sits below the shell top (`mt-2.5` / `mt-3`) — add to hero clearance. */
export const SHOWCASE_HAVEN_HEADER_FLOAT_PX = 14;

/**
 * Header is portaled `position:fixed` (out of flow) on live + Page Editor.
 * Hero copy (eyebrow / above-heading line) needs top inset so it clears the bar.
 */
export const SHOWCASE_HERO_CONTAINED_CLASS =
  'min-h-[min(var(--page-editor-preview-h,100dvh),720px)]';
export const SHOWCASE_HERO_LIVE_CLASS = 'min-h-[100dvh]';

/** Page Editor / embed preview frame — same fixed header, shorter viewport. */
export const SHOWCASE_HERO_CONTENT_TOP_CONTAINED = 'pt-32';

/** Live site — room for header + safe eyebrow gap on mobile and desktop. */
export const SHOWCASE_HERO_CONTENT_TOP_LIVE = 'pt-32 @sm:pt-36';

/** Haven floating capsule needs extra inset on top-aligned heroes. */
export const SHOWCASE_HERO_HAVEN_EXTRA_TOP_LIVE = '@md:pt-40 pt-36';
export const SHOWCASE_HERO_HAVEN_EXTRA_TOP_CONTAINED = 'pt-36';

export type ShowcaseHeroTopVariant = 'default' | 'haven' | 'editorial';

export function showcaseHeroSectionClass(containedChrome: boolean): string {
  return containedChrome ? SHOWCASE_HERO_CONTAINED_CLASS : SHOWCASE_HERO_LIVE_CLASS;
}

export function showcaseHeroContentTopClass(
  containedChrome: boolean,
  variant: ShowcaseHeroTopVariant = 'default'
): string {
  if (variant === 'haven') {
    return containedChrome
      ? SHOWCASE_HERO_HAVEN_EXTRA_TOP_CONTAINED
      : SHOWCASE_HERO_HAVEN_EXTRA_TOP_LIVE;
  }
  return containedChrome ? SHOWCASE_HERO_CONTENT_TOP_CONTAINED : SHOWCASE_HERO_CONTENT_TOP_LIVE;
}

/** Top-aligned hero sections (Editorial, Haven) — pairs top clearance with section bottom rhythm. */
export function showcaseHeroTopAlignedSectionClass(
  containedChrome: boolean,
  variant: Extract<ShowcaseHeroTopVariant, 'editorial' | 'haven'>
): string {
  const bottom =
    variant === 'haven'
      ? containedChrome
        ? 'pb-10'
        : '@md:pb-20 pb-14'
      : containedChrome
        ? 'pb-12'
        : '@sm:pb-20 pb-14';

  return cn(showcaseHeroContentTopClass(containedChrome, variant), bottom);
}
