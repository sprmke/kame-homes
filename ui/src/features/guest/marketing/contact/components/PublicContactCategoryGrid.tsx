import { Briefcase, Bug, HelpCircle, Lightbulb } from 'lucide-react';

import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_CATEGORY_DESCRIPTIONS,
  SUPPORT_TICKET_CATEGORY_LABELS,
  type SupportTicketCategory,
} from '@/features/dashboard/help-support/lib/supportTicketSchema';

import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<SupportTicketCategory, typeof Bug> = {
  bug_report: Bug,
  feature_suggestion: Lightbulb,
  general_inquiry: HelpCircle,
  business_inquiry: Briefcase,
};

type Props = {
  onSelect: (category: SupportTicketCategory) => void;
};

export function PublicContactCategoryGrid({ onSelect }: Props) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {SUPPORT_TICKET_CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICONS[category];
        return (
          <li key={category}>
            <button
              type="button"
              onClick={() => onSelect(category)}
              className={cn(
                'border-border bg-card hover:bg-muted/40 flex h-full min-h-[44px] w-full items-start gap-3 rounded-2xl border p-5 text-left transition-colors',
                'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
              )}
            >
              <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Icon className="size-5" aria-hidden />
              </div>
              <span className="min-w-0">
                <span className="text-foreground block text-base font-semibold">
                  {SUPPORT_TICKET_CATEGORY_LABELS[category]}
                </span>
                <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
                  {SUPPORT_TICKET_CATEGORY_DESCRIPTIONS[category]}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
