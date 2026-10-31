import type { ShowcaseVariant } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';

/**
 * Structural header chrome per template — keeps backgrounds / borders / shape
 * distinct so tokens alone (shared translucent bars) don’t look identical.
 */
export type ShowcaseHeaderChrome = {
  /** Classes on the `<header>` element (layout, blur, radius, border weight). */
  shell: string;
  /** Inner row padding / max-width rhythm. */
  inner: string;
  /** Desktop nav link shape. */
  navItem: string;
  /** Brand mark (logo / letter) radius. */
  brandMark: string;
  /** Theme + menu icon button. */
  iconButton: string;
  /** When header floats over a dark hero image. */
  navOnHeroActive: string;
  navOnHeroInactive: string;
};

const CHROME: Record<ShowcaseVariant, ShowcaseHeaderChrome> = {
  /** Frosted glass — soft blur, light reflection border. */
  aurora: {
    shell: 'border-b backdrop-blur-xl',
    inner: 'mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6',
    navItem: 'rounded-full px-2.5 xl:px-3',
    brandMark: 'rounded-xl',
    iconButton: 'rounded-full',
    navOnHeroActive: 'bg-white/25 text-white',
    navOnHeroInactive: 'text-white/75 hover:bg-white/10 hover:text-white',
  },
  /** Brutalist solid — thick rule, zero blur, sharp corners. */
  monolith: {
    shell: 'border-b-2',
    inner: 'mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6',
    navItem: 'rounded-none px-2.5 tracking-tight xl:px-3',
    brandMark: 'rounded-none',
    iconButton: 'rounded-none',
    navOnHeroActive: 'bg-transparent text-white underline underline-offset-8',
    navOnHeroInactive: 'text-white/70 hover:text-white',
  },
  /** Magazine masthead — opaque paper, soft hairline rule, no blur. */
  editorial: {
    shell: 'border-b shadow-none',
    inner: 'mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6',
    navItem: 'rounded-none px-2.5 xl:px-3',
    brandMark: 'rounded-sm',
    iconButton: 'rounded-sm',
    navOnHeroActive: '',
    navOnHeroInactive: '',
  },
  /** Lookbook chromeless — transparent over hero; solid hairline when scrolled. */
  verso: {
    shell: 'border-b-2',
    inner: 'mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6',
    navItem: 'rounded-none px-2.5 uppercase tracking-[0.14em] xl:px-3',
    brandMark: 'rounded-none',
    iconButton: 'rounded-none',
    navOnHeroActive:
      'bg-transparent text-white underline decoration-white/60 underline-offset-[6px]',
    navOnHeroInactive: 'text-white/70 hover:text-white',
  },
  /** Cinematic HUD — heavy glass + accent rail under the bar. */
  atlas: {
    shell:
      'relative border-b backdrop-blur-2xl after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[hsl(var(--showcase-accent,var(--primary)))]/55',
    inner: 'mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6',
    navItem: 'rounded-md px-2.5 font-mono text-[11px] uppercase tracking-[0.16em] xl:px-3',
    brandMark: 'rounded-lg',
    iconButton: 'rounded-lg',
    navOnHeroActive: 'bg-white/15 text-white',
    navOnHeroInactive: 'text-white/65 hover:bg-white/10 hover:text-white',
  },
  /** Hospitality capsule — inset floating bar with soft elevation. */
  haven: {
    shell: 'border-0 bg-transparent shadow-none',
    // Extra left pad so the logo clears the capsule curve (right already has icon hit-area breathing room).
    inner:
      'mx-auto mt-2.5 flex w-[calc(100%-1.5rem)] max-w-6xl items-center gap-3 rounded-2xl border py-2.5 pl-6 pr-5 shadow-[0_14px_40px_-18px_rgba(44,38,34,0.28)] @sm:mt-3 @sm:w-[calc(100%-2rem)] @sm:gap-4 @sm:pl-7 @sm:pr-6 @lg:w-[calc(100%-4rem)] @lg:pl-8 @lg:pr-7',
    navItem: 'rounded-full px-3 xl:px-3.5',
    brandMark: 'rounded-full',
    iconButton: 'rounded-full',
    navOnHeroActive: '',
    navOnHeroInactive: '',
  },
};

export function resolveShowcaseHeaderChrome(variant: ShowcaseVariant): ShowcaseHeaderChrome {
  return CHROME[variant];
}
