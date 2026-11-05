import type { ReactNode } from 'react';

import { MarketingPublicPageContent } from '@/features/guest/marketing/shared/components/MarketingPublicPageContent';
import { MarketingPublicPageHero } from '@/features/guest/marketing/shared/components/MarketingPublicPageHero';

interface LegalSection {
  title: string;
  paragraphs: string[];
}

interface LegalSimplePageProps {
  eyebrow?: string;
  title: string;
  description: ReactNode;
  sections: LegalSection[];
  blobPosition?: 'left' | 'right';
}

export function LegalSimplePage({
  eyebrow = 'Legal',
  title,
  description,
  sections,
  blobPosition = 'left',
}: LegalSimplePageProps) {
  return (
    <div className="bg-background min-h-screen">
      <MarketingPublicPageHero
        eyebrow={eyebrow}
        title={title}
        description={description}
        blobPosition={blobPosition}
        narrow
      />

      <MarketingPublicPageContent narrow>
        <div className="divide-border divide-y">
          {sections.map((section) => (
            <section key={section.title} className="py-6 first:pt-0 md:py-10 md:first:pb-10">
              <h2 className="text-foreground text-lg font-semibold tracking-tight md:text-2xl">
                {section.title}
              </h2>
              <div className="text-muted-foreground mt-2.5 space-y-3 text-[15px] leading-relaxed md:mt-4 md:space-y-4 md:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </MarketingPublicPageContent>
    </div>
  );
}
