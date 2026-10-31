import * as React from 'react';

import { BookOpen, Building2, Car, Home, Search, Users } from 'lucide-react';

import { HelpBackControl } from '@/features/dashboard/help-support/components/HelpBackControl';
import { HelpCard } from '@/features/dashboard/help-support/components/HelpCard';
import { HelpDisclosure } from '@/features/dashboard/help-support/components/HelpDisclosure';
import { HelpEmptyState } from '@/features/dashboard/help-support/components/HelpEmptyState';
import { HelpRichText } from '@/features/dashboard/help-support/components/HelpRichText';
import { HelpSearchField } from '@/features/dashboard/help-support/components/HelpSearchField';
import {
  HelpTopicList,
  HelpTopicRow,
} from '@/features/dashboard/help-support/components/HelpTopicList';
import { useHelpCenterArticles } from '@/features/dashboard/help-support/hooks/useHelpCenterArticles';
import type { HelpCenterArticle } from '@/features/dashboard/help-support/lib/helpCenterApi';
import {
  displayHelpArticleTitle,
  displayHelpGuideGroup,
  HELP_GUIDE_GROUPS,
  sanitizeHelpBody,
  type HelpGuideGroup,
} from '@/features/dashboard/help-support/lib/helpContentDisplay';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const GUIDE_GROUP_META: Record<HelpGuideGroup, { description: string; Icon: typeof BookOpen }> = {
  Organization: { description: 'Team and org settings', Icon: Building2 },
  Property: { description: "This listing's pages", Icon: Home },
  Parking: { description: 'Slots, rates, and bookings', Icon: Car },
  'Guest pages': { description: 'What guests see', Icon: Users },
};

function filterArticleQaItems(article: HelpCenterArticle, term: string): HelpCenterArticle | null {
  const title = displayHelpArticleTitle(article.title);
  if (title.toLowerCase().includes(term) || article.title.toLowerCase().includes(term)) {
    return article;
  }
  const qaItems = article.qaItems.filter(
    (qa) => qa.question.toLowerCase().includes(term) || qa.answer.toLowerCase().includes(term)
  );
  return qaItems.length > 0 ? { ...article, qaItems } : null;
}

function ArticleList({
  articles,
  defaultOpen,
}: {
  articles: HelpCenterArticle[];
  defaultOpen: boolean;
}) {
  return (
    <div className="px-4 sm:px-5">
      {articles.map((article) => (
        <HelpDisclosure
          key={article.routeGuidePath}
          title={displayHelpArticleTitle(article.title)}
          defaultOpen={defaultOpen}
        >
          <dl className="space-y-5">
            {article.qaItems.map((qa) => (
              <div key={qa.question}>
                <dt className="text-foreground text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">
                  <HelpRichText text={qa.question} />
                </dt>
                <dd className="mt-2 w-full leading-7 [overflow-wrap:anywhere]">
                  <HelpRichText text={sanitizeHelpBody(qa.answer)} />
                </dd>
              </div>
            ))}
          </dl>
        </HelpDisclosure>
      ))}
    </div>
  );
}

export function HelpDocumentationPage() {
  const { data, isPending, isError, refetch } = useHelpCenterArticles();
  const [search, setSearch] = React.useState('');
  const [selectedGroup, setSelectedGroup] = React.useState<HelpGuideGroup | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const term = search.trim().toLowerCase();
  const hasSearch = term.length > 0;

  React.useEffect(() => {
    if (selectedGroup) headingRef.current?.focus();
  }, [selectedGroup]);

  const articlesByGroup = React.useMemo(() => {
    const articles = data?.articles ?? [];
    const grouped = new Map<HelpGuideGroup, HelpCenterArticle[]>();
    for (const group of HELP_GUIDE_GROUPS) grouped.set(group, []);
    for (const article of articles) {
      grouped.get(displayHelpGuideGroup(article.module))?.push(article);
    }
    return grouped;
  }, [data?.articles]);

  const selectedArticles = React.useMemo(() => {
    if (!selectedGroup) return [];
    const articles = articlesByGroup.get(selectedGroup) ?? [];
    if (!hasSearch) return articles;
    return articles.reduce<HelpCenterArticle[]>((acc, article) => {
      const match = filterArticleQaItems(article, term);
      if (match) acc.push(match);
      return acc;
    }, []);
  }, [articlesByGroup, hasSearch, selectedGroup, term]);

  const openGroup = (group: HelpGuideGroup) => {
    setSearch('');
    setSelectedGroup(group);
  };

  const closeGroup = () => {
    setSearch('');
    setSelectedGroup(null);
  };

  let body: React.ReactNode;
  if (isPending) {
    body = (
      <div className="divide-border/70 space-y-0 divide-y px-4 sm:px-5">
        <Skeleton className="my-3 h-12 w-full" />
        <Skeleton className="my-3 h-12 w-full" />
        <Skeleton className="my-3 h-12 w-full" />
        <Skeleton className="my-3 h-12 w-full" />
      </div>
    );
  } else if (isError) {
    body = (
      <HelpEmptyState
        icon={BookOpen}
        title="Couldn't load guides"
        action={
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        }
      />
    );
  } else if ((data?.articles.length ?? 0) === 0) {
    body = <HelpEmptyState icon={BookOpen} title="No guides yet" />;
  } else if (selectedGroup) {
    body = (
      <div className="pb-1">
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="relative flex min-h-11 items-center">
            <div className="absolute inset-y-0 left-0 z-10 flex items-center">
              <HelpBackControl label="All topics" onClick={closeGroup} />
            </div>
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="text-foreground w-full px-12 text-center text-lg font-semibold tracking-tight outline-none sm:px-28 sm:text-xl"
            >
              {selectedGroup}
            </h3>
          </div>
          <div className="mt-4">
            <HelpSearchField
              value={search}
              onChange={setSearch}
              placeholder="Search this topic"
              label={`Search ${selectedGroup}`}
            />
          </div>
        </div>
        <div className="mt-3">
          {selectedArticles.length === 0 ? (
            <HelpEmptyState
              icon={hasSearch ? Search : BookOpen}
              title={hasSearch ? 'No guides match that search' : 'No guides in this topic yet'}
            />
          ) : (
            <ArticleList
              articles={selectedArticles}
              defaultOpen={hasSearch && selectedArticles.length === 1}
            />
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <HelpTopicList>
        {HELP_GUIDE_GROUPS.map((group) => {
          const meta = GUIDE_GROUP_META[group];
          return (
            <HelpTopicRow
              key={group}
              title={group}
              description={meta.description}
              Icon={meta.Icon}
              onClick={() => openGroup(group)}
            />
          );
        })}
      </HelpTopicList>
    );
  }

  return <HelpCard bodyClassName="p-0 sm:p-0">{body}</HelpCard>;
}
