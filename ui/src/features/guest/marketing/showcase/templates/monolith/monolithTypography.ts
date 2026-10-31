/**
 * Monolith display sizes — fluid clamps anchored to 16px body (`text-base`).
 * Scales with editor **Scale** via `--showcase-display-scale` on `.showcase-scope`.
 */

import { showcaseScaledClampExpr } from '@/features/guest/marketing/showcase/lib/showcaseTypographyScale';

/** Template display face — Instrument Serif for hero/section titles (not editor Cormorant). */
export const monolithDisplayFontClass = 'font-instrument';

/** Header chrome — clean sans for brand + nav (consistent, readable at small sizes). */
export const monolithHeaderChromeClass = 'font-sans antialiased';

export const monolithHeroTitleClass = [
  `text-[${showcaseScaledClampExpr('clamp(1.75rem,1.35rem+2.2vw,2.75rem)')}]`,
  `@md:text-[${showcaseScaledClampExpr('clamp(2rem,1.25rem+2.8vw,3.25rem)')}]`,
  `@lg:text-[${showcaseScaledClampExpr('clamp(2.25rem,1.5rem+2.2vw,3.5rem)')}]`,
  'leading-[1.02] tracking-[-0.03em]',
].join(' ');

export const monolithSectionTitleClass = [
  `text-[${showcaseScaledClampExpr('clamp(1.375rem,1.1rem+1.4vw,1.75rem)')}]`,
  `@md:text-[${showcaseScaledClampExpr('clamp(1.5rem,1.15rem+1.2vw,2rem)')}]`,
  `@lg:text-[${showcaseScaledClampExpr('clamp(1.625rem,1.25rem+1vw,2.25rem)')}]`,
  'leading-tight tracking-tight',
].join(' ');

export const monolithStatValueClass = [
  `text-[${showcaseScaledClampExpr('clamp(1.5rem,1.1rem+1.8vw,2rem)')}]`,
  `@md:text-[${showcaseScaledClampExpr('clamp(1.75rem,1.25rem+1.5vw,2.25rem)')}]`,
  'leading-tight tracking-tight',
].join(' ');

export const monolithBrandTitleClass =
  'font-sans text-sm font-medium tracking-normal @sm:text-base';
