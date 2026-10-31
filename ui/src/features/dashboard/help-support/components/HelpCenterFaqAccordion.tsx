import * as React from 'react';

import { HelpCircle } from 'lucide-react';

import { HelpCard } from '@/features/dashboard/help-support/components/HelpCard';
import { HelpDisclosure } from '@/features/dashboard/help-support/components/HelpDisclosure';
import { HelpEmptyState } from '@/features/dashboard/help-support/components/HelpEmptyState';
import { HelpRichText } from '@/features/dashboard/help-support/components/HelpRichText';
import { useHelpCenterFaqs } from '@/features/dashboard/help-support/hooks/useHelpCenterFaqs';
import { sanitizeHelpBody } from '@/features/dashboard/help-support/lib/helpContentDisplay';
import { pickCommonFaqs } from '@/features/dashboard/help-support/lib/helpFaqModules';
import { useHelpSupportAdminScope } from '@/features/dashboard/help-support/lib/helpSupportPaths';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function HelpCenterFaqAccordion() {
  const scope = useHelpSupportAdminScope();
  const { data, isPending, isError, refetch } = useHelpCenterFaqs();
  const visibleFaqs = React.useMemo(
    () => pickCommonFaqs(data?.faqs ?? [], scope),
    [data?.faqs, scope]
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
  } else if (visibleFaqs.length === 0) {
    body = <HelpEmptyState icon={HelpCircle} title="No FAQs yet" />;
  } else {
    body = (
      <div className="px-4 sm:px-5">
        {visibleFaqs.map((faq) => (
          <HelpDisclosure key={faq.id} title={faq.question}>
            <HelpRichText text={sanitizeHelpBody(faq.answer)} />
          </HelpDisclosure>
        ))}
      </div>
    );
  }

  return <HelpCard bodyClassName="p-0 sm:p-0">{body}</HelpCard>;
}
