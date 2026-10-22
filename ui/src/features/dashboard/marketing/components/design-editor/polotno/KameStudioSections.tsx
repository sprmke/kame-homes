import { createContext, useContext, type ReactNode } from 'react';

import { Grid2x2, LayoutTemplate, Sparkles, Star } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { SectionTab } from 'openpolotno/side-panel/side-panel';

import { KameSidePanelShell } from '@/features/dashboard/marketing/components/design-editor/polotno/KameSidePanelShell';

/**
 * Posts editor rail sections that live in our React tree (templates, collage, guest
 * reviews, AI). Section objects are module constants so Polotno never remounts them;
 * their content comes from `KameStudioSectionsProvider`.
 */
export type KameStudioSectionContent = {
  templates: ReactNode;
  collage: ReactNode;
  reviews: ReactNode;
  ai: ReactNode | null;
};

const KameStudioSectionsContext = createContext<KameStudioSectionContent | null>(null);

export function KameStudioSectionsProvider({
  value,
  children,
}: {
  value: KameStudioSectionContent;
  children: ReactNode;
}) {
  return (
    <KameStudioSectionsContext.Provider value={value}>
      {children}
    </KameStudioSectionsContext.Provider>
  );
}

function useSectionContent(key: keyof KameStudioSectionContent): ReactNode {
  return useContext(KameStudioSectionsContext)?.[key] ?? null;
}

function sectionTab(label: string, icon: ReactNode) {
  return observer(function KameStudioTab(props: Record<string, unknown>) {
    return (
      <SectionTab name={label} iconSize={16} {...props}>
        <span className="inline-flex size-4 items-center justify-center">{icon}</span>
      </SectionTab>
    );
  });
}

function panel(key: keyof KameStudioSectionContent, title: string) {
  return function KameStudioPanel() {
    const content = useSectionContent(key);
    return (
      <KameSidePanelShell title={title}>
        <div className="min-w-0">{content}</div>
      </KameSidePanelShell>
    );
  };
}

export const KAME_TEMPLATES_SECTION = 'kame-templates';
export const KAME_COLLAGE_SECTION = 'kame-collage';
export const KAME_REVIEWS_SECTION = 'kame-reviews';
export const KAME_AI_SECTION = 'kame-ai';

export const templatesSection = {
  name: KAME_TEMPLATES_SECTION,
  Tab: sectionTab('Templates', <LayoutTemplate className="size-4" aria-hidden />),
  Panel: panel('templates', 'Templates'),
};

export const collageSection = {
  name: KAME_COLLAGE_SECTION,
  Tab: sectionTab('Collage', <Grid2x2 className="size-4" aria-hidden />),
  Panel: panel('collage', 'Collage'),
};

export const reviewsSection = {
  name: KAME_REVIEWS_SECTION,
  Tab: sectionTab('Reviews', <Star className="size-4" aria-hidden />),
  Panel: panel('reviews', 'Guest reviews'),
};

export const aiSection = {
  name: KAME_AI_SECTION,
  Tab: sectionTab('AI', <Sparkles className="size-4" aria-hidden />),
  Panel: panel('ai', 'Make with AI'),
};
