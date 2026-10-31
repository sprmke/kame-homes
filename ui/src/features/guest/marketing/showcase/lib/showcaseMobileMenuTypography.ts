import type { ShowcaseVariant } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';

/**
 * Hamburger menu typography — body-scale anchor with fluid `cqw` sizing so
 * labels read comfortably in live view and Page Editor preview frames.
 * Class strings must stay literal for Tailwind JIT.
 */

/** Sans / grotesk templates — one step above body copy (~16–20px). */
export const showcaseMobileMenuItemStandardClass =
  'text-[length:clamp(calc(1rem*var(--showcase-body-scale,1)),calc(0.625rem+3.2cqw),calc(1.25rem*var(--showcase-body-scale,1)))] leading-snug';

/** Serif / display templates — optical bump (~17–21px). */
export const showcaseMobileMenuItemSerifClass =
  'text-[length:clamp(calc(1.0625rem*var(--showcase-body-scale,1)),calc(0.7rem+3.4cqw),calc(1.3125rem*var(--showcase-body-scale,1)))] leading-snug';

/** Uppercase tracking templates (Verso) — balanced cap height (~15–19px). */
export const showcaseMobileMenuItemCapsClass =
  'text-[length:clamp(calc(0.9375rem*var(--showcase-body-scale,1)),calc(0.55rem+2.9cqw),calc(1.1875rem*var(--showcase-body-scale,1)))] leading-snug';

export const showcaseMobileMenuItemSizeByVariant: Record<ShowcaseVariant, string> = {
  aurora: showcaseMobileMenuItemStandardClass,
  atlas: showcaseMobileMenuItemStandardClass,
  monolith: showcaseMobileMenuItemSerifClass,
  editorial: showcaseMobileMenuItemSerifClass,
  haven: showcaseMobileMenuItemSerifClass,
  verso: showcaseMobileMenuItemCapsClass,
};

/** Property name in the menu header (~17–22px). */
export const showcaseMobileMenuTitleClass =
  'text-[length:clamp(calc(1.0625rem*var(--showcase-body-scale,1)),calc(0.6rem+2.8cqw),calc(1.375rem*var(--showcase-body-scale,1)))] font-medium leading-tight';

/** Serif display titles in menu header (~18–24px). */
export const showcaseMobileMenuTitleSerifClass =
  'text-[length:clamp(calc(1.125rem*var(--showcase-body-scale,1)),calc(0.65rem+3cqw),calc(1.5rem*var(--showcase-body-scale,1)))] font-medium leading-tight';

export const showcaseMobileMenuTitleSizeByVariant: Record<ShowcaseVariant, string> = {
  aurora: showcaseMobileMenuTitleClass,
  atlas: showcaseMobileMenuTitleClass,
  verso: showcaseMobileMenuTitleClass,
  monolith: showcaseMobileMenuTitleSerifClass,
  editorial: showcaseMobileMenuTitleSerifClass,
  haven: showcaseMobileMenuTitleSerifClass,
};

/** Eyebrow label (Explore / Sections). */
export const showcaseMobileMenuEyebrowClass =
  'text-[length:calc(0.75rem*var(--showcase-body-scale,1))] uppercase tracking-[0.16em]';

/** Verso / Atlas index prefix. */
export const showcaseMobileMenuIndexClass =
  'text-[length:calc(0.75rem*var(--showcase-body-scale,1))] tabular-nums tracking-[0.24em]';

/** Comfortable tap target with balanced vertical rhythm. */
export const showcaseMobileMenuItemPadClass = 'px-3 py-3 @sm:px-3.5 @sm:py-3.5';
