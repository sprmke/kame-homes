import * as React from 'react';

import { HelpCircle, Search } from 'lucide-react';

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
import { useHelpCenterFaqs } from '@/features/dashboard/help-support/hooks/useHelpCenterFaqs';
import { sanitizeHelpBody } from '@/features/dashboard/help-support/lib/helpContentDisplay';
import {
  availableFaqCategories,
  browseFaqs,
  pickCommonFaqs,
} from '@/features/dashboard/help-support/lib/helpFaqModules';
import { useHelpSupportAdminScope } from '@/features/dashboard/help-support/lib/helpSupportPaths';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function HelpCenterFaqAccordion() {
  const scope = useHelpSupportAdminScope();
  const { data, isPending, isError, refetch } = useHelpCenterFaqs();
  const [search, setSearch] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);

  const faqs = data?.faqs ?? [];
  const term = search.trim();
  const commonFaqs = React.useMemo(() => pickCommonFaqs(faqs, scope), [faqs, scope]);
  const categories = React.useMemo(() => availableFaqCategories(faqs, scope), [faqs, scope]);
  const browseResults = React.useMemo(
    () =>
      browseFaqs(faqs, scope, {
        category: selectedCategory ?? undefined,
        term,
      }),
    [faqs, scope, selectedCategory, term]
  );

  const openCategory = (category: string) => {
    setSearch('');
    setSelectedCategory(category);
  };

  const closeCategory = () => {
    setSearch('');
    setSelectedCategory(null);
  };

  const renderFaqs = (items: typeof faqs) => (
    <div className="px-4 sm:px-5">
      {items.map((faq) => (
        <HelpDisclosure key={faq.id} title={faq.question}>
          <HelpRichText text={sanitizeHelpBody(faq.answer)} />
        </HelpDisclosure>
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (isPending) {
    body = (
      <div className="px-4 sm:px-5">
        <Skeleton className="my-3 h-12 w-full" />
        <Skeleton className="my-3 h-12 w-full" />
        <Skeleton className="my-3 h-12 w-full" />
        <Skeleton className="my-3 h-12 w-full" />
      </div>
    );
  } else if (isError) {
    body = (
      <HelpEmptyState
        icon={HelpCircle}
        title="Couldn't load FAQs"
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
  } else if (faqs.length === 0) {
    body = <HelpEmptyState icon={HelpCircle} title="No FAQs yet" />;
  } else if (selectedCategory || term) {
    body = (
      <div className="pb-1">
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="relative flex min-h-11 items-center">
            {selectedCategory ? (
              <div className="absolute inset-y-0 left-0 z-10 flex items-center">
                <HelpBackControl label="All topics" onClick={closeCategory} />
              </div>
            ) : null}
            <h3 className="text-foreground w-full px-12 text-center text-lg font-semibold tracking-tight sm:px-28 sm:text-xl">
              {selectedCategory ?? 'Search FAQs'}
            </h3>
          </div>
          <div className="mt-4">
            <HelpSearchField
              value={search}
              onChange={setSearch}
              placeholder={selectedCategory ? 'Search this topic' : 'Search FAQs'}
              label={selectedCategory ? `Search ${selectedCategory}` : 'Search FAQs'}
            />
          </div>
        </div>
        <div className="mt-3">
          {browseResults.length === 0 ? (
            <HelpEmptyState
              icon={term ? Search : HelpCircle}
              title={term ? 'No FAQs match that search' : 'No FAQs in this topic yet'}
            />
          ) : (
            renderFaqs(browseResults)
          )}
        </div>
      </div>
    );
  } else {
    const counts = new Map<string, number>();
    for (const faq of browseFaqs(faqs, scope)) {
      counts.set(faq.category, (counts.get(faq.category) ?? 0) + 1);
    }

    body = (
      <div className="pb-1">
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <HelpSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search FAQs"
            label="Search FAQs"
          />
        </div>
        <div className="mt-3">
          {renderFaqs(commonFaqs)}
          {categories.length > 0 ? (
            <div className="border-border/70 mt-2 border-t pt-2">
              <HelpTopicList>
                {categories.map((category) => (
                  <HelpTopicRow
                    key={category}
                    title={category}
                    description={`${counts.get(category) ?? 0} questions`}
                    Icon={HelpCircle}
                    onClick={() => openCategory(category)}
                  />
                ))}
              </HelpTopicList>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return <HelpCard bodyClassName="p-0 sm:p-0">{body}</HelpCard>;
}
