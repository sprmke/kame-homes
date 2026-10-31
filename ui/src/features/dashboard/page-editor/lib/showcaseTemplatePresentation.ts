import type { ShowcaseVariant } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';
import { SHOWCASE_TEMPLATE_REGISTRY } from '@/features/guest/marketing/showcase/templates/registry';
import type { ShowcaseTemplateKey } from '@/features/guest/marketing/showcase/types/showcase';

export type ShowcaseTemplatePresentation = {
  key: ShowcaseTemplateKey;
  label: string;
  variant: ShowcaseVariant;
  /** Short phrase for screen readers — not shown in UI. */
  mood: string;
};

const MOODS: Record<ShowcaseVariant, string> = {
  aurora: 'glass hero with soft motion',
  monolith: 'bold brutalist editorial',
  editorial: 'magazine masthead layout',
  verso: 'dark lookbook typography',
  atlas: 'cinematic HUD chrome',
  haven: 'warm rounded capsule header',
};

export const SHOWCASE_TEMPLATE_PRESENTATION: ShowcaseTemplatePresentation[] =
  SHOWCASE_TEMPLATE_REGISTRY.map((entry) => ({
    key: entry.key,
    label: entry.label,
    variant: entry.variant,
    mood: MOODS[entry.variant],
  }));
