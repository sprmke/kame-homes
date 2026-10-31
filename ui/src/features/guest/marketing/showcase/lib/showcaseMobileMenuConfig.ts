import type { ShowcaseVariant } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';

export type ShowcaseMobileMenuMotion =
  'slide-up' | 'slide-down' | 'slide-right' | 'curtain' | 'glass-fade';

export type ShowcaseMobileMenuVariantConfig = {
  motion: ShowcaseMobileMenuMotion;
  /** Opaque full-screen panel — uses showcase surface/ink vars (not dashboard theme). */
  panel: string;
  backdrop: string;
  header: string;
  eyebrow: string;
  title: string;
  closeButton: string;
  item: string;
  itemActive: string;
  itemIdle: string;
  index?: string;
  showIndices?: boolean;
  uppercase?: boolean;
};

const MENU_HEADER =
  'border-b border-[hsl(var(--showcase-border,var(--border)))] px-4 py-3.5 @sm:px-5 @sm:py-4';

const MENU_EYEBROW = 'text-[hsl(var(--showcase-ink-muted,var(--muted-foreground)))]';

const CLOSE_ROUNDED =
  'rounded-full border border-[hsl(var(--showcase-border,var(--border)))] hover:bg-[hsl(var(--showcase-accent,var(--primary))/0.12)]';

const CLOSE_SQUARE =
  'rounded-none border border-[hsl(var(--showcase-border,var(--border)))] hover:bg-[hsl(var(--showcase-accent,var(--primary))/0.12)]';

const CLOSE_LG =
  'rounded-lg border border-[hsl(var(--showcase-border,var(--border)))] hover:bg-[hsl(var(--showcase-accent,var(--primary))/0.12)]';

/**
 * Menu chrome uses showcase ink/surface/accent vars set on `.showcase-scope`
 * (and copied onto portaled menus). Never rely on dashboard `dark:` alone.
 * Type sizes live in `showcaseMobileMenuTypography.ts` + `ShowcaseMobileMenu`.
 * Class strings must be complete static literals for Tailwind JIT.
 */
export const SHOWCASE_MOBILE_MENU: Record<ShowcaseVariant, ShowcaseMobileMenuVariantConfig> = {
  aurora: {
    motion: 'slide-down',
    panel:
      'bg-[hsl(var(--showcase-surface,var(--background)))] text-[hsl(var(--showcase-ink,var(--foreground)))] shadow-2xl',
    backdrop: 'bg-[hsl(var(--showcase-ink)/0.45)] backdrop-blur-[6px]',
    header: MENU_HEADER,
    eyebrow: MENU_EYEBROW,
    title: 'font-medium text-[hsl(var(--showcase-ink,var(--foreground)))]',
    closeButton: CLOSE_ROUNDED,
    item: 'rounded-2xl font-medium tracking-tight transition-colors duration-200',
    itemActive:
      'bg-[hsl(var(--showcase-accent,var(--primary))/0.15)] text-[hsl(var(--showcase-accent,var(--primary)))]',
    itemIdle:
      'text-[hsl(var(--showcase-ink,var(--foreground)))] hover:bg-[hsl(var(--showcase-surface-elevated,var(--muted))/0.85)]',
  },
  monolith: {
    motion: 'curtain',
    panel:
      'bg-[hsl(var(--showcase-surface,var(--background)))] text-[hsl(var(--showcase-ink,var(--foreground)))]',
    backdrop: 'bg-[hsl(var(--showcase-ink)/0.5)]',
    header: MENU_HEADER,
    eyebrow: MENU_EYEBROW,
    title: 'font-instrument text-[hsl(var(--showcase-ink,var(--foreground)))]',
    closeButton: CLOSE_SQUARE,
    item: 'rounded-none font-instrument tracking-tight transition-colors duration-200',
    itemActive: 'text-[hsl(var(--showcase-accent,var(--primary)))]',
    itemIdle:
      'text-[hsl(var(--showcase-ink,var(--foreground)))] hover:text-[hsl(var(--showcase-accent,var(--primary)))]',
  },
  editorial: {
    motion: 'slide-up',
    panel:
      'rounded-t-[2rem] bg-[hsl(var(--showcase-surface,var(--background)))] text-[hsl(var(--showcase-ink,var(--foreground)))] shadow-[0_-24px_80px_hsl(var(--showcase-ink)/0.2)]',
    backdrop: 'bg-[hsl(var(--showcase-ink)/0.4)] backdrop-blur-[3px]',
    header:
      'border-b border-[hsl(var(--showcase-border,var(--border)))] px-4 py-3.5 @sm:px-6 @sm:py-4',
    eyebrow: MENU_EYEBROW,
    title: 'font-cormorant text-[hsl(var(--showcase-ink,var(--foreground)))]',
    closeButton: CLOSE_ROUNDED,
    item: 'font-cormorant rounded-xl tracking-tight transition-colors duration-200',
    itemActive:
      'bg-[hsl(var(--showcase-surface-elevated,var(--muted)))] text-[hsl(var(--showcase-ink,var(--foreground)))] ring-1 ring-[hsl(var(--showcase-accent,var(--primary))/0.35)]',
    itemIdle:
      'text-[hsl(var(--showcase-ink,var(--foreground))/0.88)] hover:bg-[hsl(var(--showcase-surface-elevated,var(--muted))/0.72)]',
  },
  verso: {
    motion: 'slide-right',
    panel:
      'bg-[hsl(var(--showcase-surface,var(--background)))] text-[hsl(var(--showcase-ink,var(--foreground)))] shadow-[-24px_0_60px_hsl(var(--showcase-ink)/0.12)]',
    backdrop: 'bg-[hsl(var(--showcase-ink)/0.48)] backdrop-blur-[2px]',
    header: MENU_HEADER,
    eyebrow: MENU_EYEBROW,
    title: 'font-jost uppercase tracking-[0.1em] text-[hsl(var(--showcase-ink,var(--foreground)))]',
    closeButton: CLOSE_SQUARE,
    item: 'font-jost text-left font-semibold uppercase tracking-[0.06em] transition-[color,transform] duration-200',
    itemActive: 'text-[hsl(var(--showcase-accent,var(--primary)))]',
    itemIdle: 'text-[hsl(var(--showcase-ink,var(--foreground))/0.88)] hover:translate-x-0.5',
    index:
      'font-jost mr-3 min-w-[2ch] font-semibold text-[hsl(var(--showcase-ink-muted,var(--muted-foreground)))]',
    showIndices: true,
    uppercase: true,
  },
  atlas: {
    motion: 'glass-fade',
    panel:
      'bg-[hsl(var(--showcase-surface,var(--background)))] text-[hsl(var(--showcase-ink,var(--foreground)))] shadow-[0_0_0_1px_hsl(var(--showcase-border,var(--border)))]',
    backdrop: 'bg-[hsl(var(--showcase-ink)/0.4)] backdrop-blur-[4px]',
    header: MENU_HEADER,
    eyebrow: 'font-mono text-[hsl(var(--showcase-ink-muted,var(--muted-foreground)))]',
    title: 'font-grotesk text-[hsl(var(--showcase-ink,var(--foreground)))]',
    closeButton: CLOSE_LG,
    item: 'font-grotesk rounded-xl text-left font-medium transition-colors duration-200',
    itemActive:
      'bg-[hsl(var(--showcase-accent,var(--primary))/0.14)] text-[hsl(var(--showcase-ink,var(--foreground)))]',
    itemIdle:
      'text-[hsl(var(--showcase-ink,var(--foreground))/0.88)] hover:bg-[hsl(var(--showcase-surface-elevated,var(--muted))/0.72)]',
    index:
      'font-mono mr-3 min-w-[2ch] uppercase text-[hsl(var(--showcase-ink-muted,var(--muted-foreground)))]',
    showIndices: true,
  },
  haven: {
    motion: 'slide-up',
    panel:
      'rounded-t-[2.5rem] bg-[hsl(var(--showcase-surface,var(--background)))] text-[hsl(var(--showcase-ink,var(--foreground)))] shadow-[0_-20px_60px_hsl(var(--showcase-ink)/0.18)]',
    backdrop: 'bg-[hsl(var(--showcase-ink)/0.4)] backdrop-blur-[4px]',
    header:
      'border-b border-[hsl(var(--showcase-border,var(--border)))] px-4 py-3.5 @sm:px-6 @sm:py-4',
    eyebrow: MENU_EYEBROW,
    title: 'font-fraunces text-[hsl(var(--showcase-ink,var(--foreground)))]',
    closeButton: CLOSE_ROUNDED,
    item: 'font-fraunces rounded-2xl font-medium transition-colors duration-200',
    itemActive:
      'bg-[hsl(var(--showcase-surface-elevated,var(--muted)))] text-[hsl(var(--showcase-ink,var(--foreground)))] ring-1 ring-[hsl(var(--showcase-accent,var(--primary))/0.3)]',
    itemIdle:
      'text-[hsl(var(--showcase-ink,var(--foreground))/0.88)] hover:bg-[hsl(var(--showcase-surface-elevated,var(--muted))/0.72)]',
  },
};
