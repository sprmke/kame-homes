import { ChevronDown } from 'lucide-react';

import {
  PLAN_FAQ_ITEMS,
  PLANS_TAB_SECTION_TITLES,
  planTabCardHeadingClass,
} from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type PlanFaqSectionProps = {
  className?: string;
};

export function PlanFaqSection({ className }: PlanFaqSectionProps) {
  return (
    <FloatingPanel
      as="section"
      padding="lg"
      aria-labelledby="plan-faq-heading"
      className={className}
    >
      <h2 id="plan-faq-heading" className={planTabCardHeadingClass}>
        {PLANS_TAB_SECTION_TITLES.faqs}
      </h2>

      <div className="space-y-3">
        {PLAN_FAQ_ITEMS.map((faq) => (
          <Collapsible key={faq.question}>
            <CollapsibleTrigger
              className={cn(
                'border-border hover:bg-muted/40 group flex min-h-11 w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2'
              )}
            >
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{faq.question}</span>
              <ChevronDown
                className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="text-muted-foreground px-4 pb-1 pt-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
                {faq.answer}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </FloatingPanel>
  );
}
