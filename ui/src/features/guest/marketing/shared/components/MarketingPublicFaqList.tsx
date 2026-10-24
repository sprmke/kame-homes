import type { ReactNode } from 'react';

import { MarketingPublicSectionHeading } from '@/features/guest/marketing/shared/components/MarketingPublicSectionHeading';

export interface MarketingPublicFaqItem {
  question: string;
  answer: ReactNode;
}

interface MarketingPublicFaqListProps {
  title: string;
  items: MarketingPublicFaqItem[];
  className?: string;
}

export function MarketingPublicFaqList({ title, items, className }: MarketingPublicFaqListProps) {
  return (
    <section className={className}>
      <MarketingPublicSectionHeading title={title} />
      <dl className="mt-5 space-y-5 md:mt-8 md:space-y-7">
        {items.map(({ question, answer }) => (
          <div key={question}>
            <dt className="public-card-title text-foreground font-semibold">{question}</dt>
            <dd className="text-muted-foreground mt-1.5 text-sm leading-relaxed md:mt-2 md:text-base">
              {answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
