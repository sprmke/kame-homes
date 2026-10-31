import { BookOpen, ChevronDown } from 'lucide-react';

import {
  PLAYBOOK_ARTICLE_TRIGGER_ATTR,
  playbookArticleElementId,
} from '@/features/dashboard/analytics/lib/playbookReveal';
import type { AnalyticsPlaybookArticle } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type Props = {
  articles: AnalyticsPlaybookArticle[];
  /** Expanded article slug. Controlled so an AI review pill can open the matching article. */
  openSlug: string | null;
  onOpenSlugChange: (slug: string | null) => void;
  className?: string;
};

function PlaybookCard({
  article,
  open,
  onOpenChange,
}: {
  article: AnalyticsPlaybookArticle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <li
      id={playbookArticleElementId(article.slug)}
      className="border-border/60 scroll-mt-20 overflow-hidden rounded-lg border"
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            {...{ [PLAYBOOK_ARTICLE_TRIGGER_ATTR]: '' }}
            className="hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center justify-between gap-2 p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            <span className="min-w-0">
              <span className="text-muted-foreground block text-[11px] uppercase tracking-wide">
                {article.category}
              </span>
              <span className="text-foreground block text-sm font-medium">{article.title}</span>
            </span>
            <ChevronDown
              className={cn(
                'text-muted-foreground size-4 shrink-0 transition-transform motion-reduce:transition-none',
                open && 'rotate-180'
              )}
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="text-muted-foreground border-border/60 whitespace-pre-line border-t p-2.5 pt-2 text-sm leading-relaxed">
            {article.bodyMd}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

export function PlaybookList({ articles, openSlug, onOpenSlugChange, className }: Props) {
  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader
        icon={BookOpen}
        title="Improvement Playbook"
        description="Tips matched to this property's current numbers"
        iconClassName="bg-muted/80"
      />
      {articles.length > 0 ? (
        <ul className="space-y-2">
          {articles.map((article) => (
            <PlaybookCard
              key={article.slug}
              article={article}
              open={openSlug === article.slug}
              onOpenChange={(next) => onOpenSlugChange(next ? article.slug : null)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nothing matched right now — check back as your numbers change.
        </p>
      )}
    </section>
  );
}
