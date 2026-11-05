import { useMemo, type ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { HelpCircle } from 'lucide-react';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GUEST_ACCOUNT_TICKETS_PATH } from '@/features/guest/account/lib/guestAccountPaths';
import { usePublicSupportFaqs } from '@/features/guest/marketing/hooks/usePublicSupportFaqs';
import { isGuestFaq } from '@/features/guest/marketing/lib/publicSupportApi';

import { HelpDisclosure } from '@/features/dashboard/help-support/components/HelpDisclosure';
import { HelpEmptyState } from '@/features/dashboard/help-support/components/HelpEmptyState';
import { HelpRichText } from '@/features/dashboard/help-support/components/HelpRichText';
import { sanitizeHelpBody } from '@/features/dashboard/help-support/lib/helpContentDisplay';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function GuestAccountHelpPage() {
  usePageTitle(publicPageTitle('Help'));
  const { data, isPending, isError, refetch } = usePublicSupportFaqs();

  const groups = useMemo(() => {
    const faqs = (data?.faqs ?? []).filter(isGuestFaq);
    const byCategory = new Map<string, typeof faqs>();
    for (const faq of faqs) {
      const list = byCategory.get(faq.category) ?? [];
      list.push(faq);
      byCategory.set(faq.category, list);
    }
    return [...byCategory.entries()];
  }, [data?.faqs]);

  let body: ReactNode;
  if (isPending) {
    body = (
      <div className="space-y-6">
        {[0, 1, 2].map((group) => (
          <div key={group} className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    );
  } else if (isError) {
    body = (
      <HelpEmptyState
        icon={HelpCircle}
        title="Couldn't load help"
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
  } else if (groups.length === 0) {
    body = <HelpEmptyState icon={HelpCircle} title="No help topics yet" />;
  } else {
    body = (
      <div className="space-y-7">
        {groups.map(([category, faqs]) => (
          <section key={category} className="space-y-2">
            <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
              {category}
            </h2>
            {faqs.map((faq) => (
              <HelpDisclosure key={faq.id} title={faq.question}>
                <HelpRichText text={sanitizeHelpBody(faq.answer)} />
              </HelpDisclosure>
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <GuestAccountContentCard>
      {body}
      <div className="border-border/70 mt-6 border-t pt-4">
        <Button variant="outline" className="min-h-11 rounded-full" asChild>
          <Link to={GUEST_ACCOUNT_TICKETS_PATH}>Contact support</Link>
        </Button>
      </div>
    </GuestAccountContentCard>
  );
}
