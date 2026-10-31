import { lazy, type ComponentType } from 'react';

import type {
  ShowcaseData,
  ShowcaseTemplateKey,
} from '@/features/guest/marketing/showcase/types/showcase';

export type ShowcaseTemplateEntry = {
  key: ShowcaseTemplateKey;
  label: string;
  variant: 'aurora' | 'monolith' | 'editorial' | 'verso' | 'atlas' | 'haven';
  component: ComponentType<{ data: ShowcaseData }>;
};

export const SHOWCASE_TEMPLATE_REGISTRY: ShowcaseTemplateEntry[] = [
  {
    key: 'showcase-aurora',
    label: 'Aurora',
    variant: 'aurora',
    component: lazy(() =>
      import('@/features/guest/marketing/showcase/templates/aurora/AuroraTemplate').then((m) => ({
        default: m.AuroraTemplate,
      }))
    ),
  },
  {
    key: 'showcase-monolith',
    label: 'Monolith',
    variant: 'monolith',
    component: lazy(() =>
      import('@/features/guest/marketing/showcase/templates/monolith/MonolithTemplate').then(
        (m) => ({
          default: m.MonolithTemplate,
        })
      )
    ),
  },
  {
    key: 'showcase-editorial',
    label: 'Editorial',
    variant: 'editorial',
    component: lazy(() =>
      import('@/features/guest/marketing/showcase/templates/editorial/EditorialTemplate').then(
        (m) => ({
          default: m.EditorialTemplate,
        })
      )
    ),
  },
  {
    key: 'showcase-verso',
    label: 'Verso',
    variant: 'verso',
    component: lazy(() =>
      import('@/features/guest/marketing/showcase/templates/verso/VersoTemplate').then((m) => ({
        default: m.VersoTemplate,
      }))
    ),
  },
  {
    key: 'showcase-atlas',
    label: 'Atlas',
    variant: 'atlas',
    component: lazy(() =>
      import('@/features/guest/marketing/showcase/templates/atlas/AtlasTemplate').then((m) => ({
        default: m.AtlasTemplate,
      }))
    ),
  },
  {
    key: 'showcase-haven',
    label: 'Haven',
    variant: 'haven',
    component: lazy(() =>
      import('@/features/guest/marketing/showcase/templates/haven/HavenTemplate').then((m) => ({
        default: m.HavenTemplate,
      }))
    ),
  },
];

export function getShowcaseTemplate(key: string): ShowcaseTemplateEntry {
  return (
    SHOWCASE_TEMPLATE_REGISTRY.find((entry) => entry.key === key) ?? SHOWCASE_TEMPLATE_REGISTRY[0]!
  );
}
