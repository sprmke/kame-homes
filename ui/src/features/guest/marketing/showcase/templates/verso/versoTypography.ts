/**
 * Verso display sizes — fluid clamps use **cqw** (showcase `@container`) not **vw**,
 * so Page Editor mobile preview (~420px) matches real narrow viewports.
 * Scales with editor **Scale** via `--showcase-display-scale`.
 */

import { showcaseScaledClampExpr } from '@/features/guest/marketing/showcase/lib/showcaseTypographyScale';

export const versoHeroTitleClass = `text-[${showcaseScaledClampExpr('clamp(2.75rem,13cqw,9rem)')}] font-semibold uppercase leading-[0.86]`;

export const versoMarqueeTitleClass = `text-[${showcaseScaledClampExpr('clamp(1.75rem,6cqw,4rem)')}] font-semibold uppercase`;

export const versoChapterTitleClass = `text-[${showcaseScaledClampExpr('clamp(1.8rem,5cqw,3rem)')}] font-semibold uppercase`;

export const versoCtaTitleClass = `text-[${showcaseScaledClampExpr('clamp(2.25rem,9cqw,5.5rem)')}] font-semibold uppercase leading-[0.9]`;

export const versoAboutStatementClass = `max-w-4xl text-[${showcaseScaledClampExpr('clamp(1.5rem,3.6cqw,2.75rem)')}] font-normal leading-[1.18]`;

export const versoAmenityItemClass = `min-w-0 break-words text-[${showcaseScaledClampExpr('clamp(1.05rem,2.6cqw,1.9rem)')}] uppercase`;

export const versoHighlightValueClass = `block break-words text-[${showcaseScaledClampExpr('clamp(1.9rem,5.5cqw,4.25rem)')}] font-semibold leading-[1.05]`;

export const versoTestimonialQuoteClass = `-mt-4 text-[${showcaseScaledClampExpr('clamp(1.4rem,3.6cqw,2.5rem)')}] font-normal leading-[1.25]`;
