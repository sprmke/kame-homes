import { useState } from 'react';

import { Link } from 'react-router-dom';

import { ArrowRight, LifeBuoy } from 'lucide-react';

import { usePublicSupportFaqs } from '@/features/guest/marketing/hooks/usePublicSupportFaqs';
import {
  isGuestFaq,
  isHostFaq,
  type PublicSupportFaq,
} from '@/features/guest/marketing/lib/publicSupportApi';
import { MarketingPublicCallout } from '@/features/guest/marketing/shared/components/MarketingPublicCallout';
import {
  MarketingPublicFaqList,
  type MarketingPublicFaqItem,
} from '@/features/guest/marketing/shared/components/MarketingPublicFaqList';
import { MarketingPublicPageContent } from '@/features/guest/marketing/shared/components/MarketingPublicPageContent';
import { MarketingPublicPageHero } from '@/features/guest/marketing/shared/components/MarketingPublicPageHero';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { PLATFORM_CONTACT_EMAIL } from '@/lib/platformBranding';

const PREVIEW_LIMIT = 8;

const fallbackGuestFaqs: MarketingPublicFaqItem[] = [
  {
    question: 'What happens after I submit a booking form?',
    answer:
      'Your stay enters host review. You may be asked for documents such as ID, payment receipt, or pet and parking papers. When requirements are met, the booking moves toward check-in, then check-out, and finally the security-deposit refund if one was collected.',
  },
  {
    question: 'Where do I upload IDs or receipts?',
    answer:
      'Use the booking form or the follow-up links in your email for that property. Upload only what the host requests for your stay.',
  },
  {
    question: 'How do security deposit refunds work?',
    answer:
      'After check-out, eligible stays open a security-deposit refund form. You provide bank or GCash payout details, and the host processes the refund through the booking workflow.',
  },
  {
    question: 'Can I message the host?',
    answer: (
      <>
        If the property offers guest messaging, use the stay or property message link you were
        given. Otherwise email{' '}
        <a
          href={`mailto:${PLATFORM_CONTACT_EMAIL}`}
          className="text-brand-ink font-medium hover:underline"
        >
          {PLATFORM_CONTACT_EMAIL}
        </a>{' '}
        with your booking ID.
      </>
    ),
  },
];

const fallbackHostFaqs: MarketingPublicFaqItem[] = [
  {
    question: 'How do I start hosting?',
    answer: (
      <>
        Open{' '}
        <Link to="/for-hosts" className="text-brand-ink font-medium hover:underline">
          For Hosts
        </Link>
        , create an account, and set up your organization and properties. Team invites and
        permissions are managed from the dashboard.
      </>
    ),
  },
  {
    question: 'What does the booking status flow cover?',
    answer:
      'Pending review, documents, ready for check-in, ready for check-out, security-deposit refund, then completed, plus cancel when needed. Email and related automations run through the shared workflow.',
  },
  {
    question: 'Where is pricing explained?',
    answer: (
      <>
        See{' '}
        <Link to="/for-hosts/pricing" className="text-brand-ink font-medium hover:underline">
          host pricing
        </Link>
        . Start free with one property, then upgrade from the dashboard as you add listings or team
        members.
      </>
    ),
  },
];

function toFaqItems(faqs: PublicSupportFaq[]): MarketingPublicFaqItem[] {
  return faqs.map((faq) => ({ question: faq.question, answer: faq.answer }));
}

function SupportFaqSection({
  title,
  items,
  fallback,
  className,
}: {
  title: string;
  items: MarketingPublicFaqItem[];
  fallback: MarketingPublicFaqItem[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const source = items.length > 0 ? items : fallback;
  const visible = expanded ? source : source.slice(0, PREVIEW_LIMIT);

  return (
    <div className={className}>
      <MarketingPublicFaqList title={title} items={visible} />
      {source.length > PREVIEW_LIMIT ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-4 min-h-11 rounded-full px-3"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : `Show all ${source.length}`}
        </Button>
      ) : null}
    </div>
  );
}

export function SupportPage() {
  usePageTitle(publicPageTitle('Support'));
  const { data, isPending } = usePublicSupportFaqs();

  const guestFaqs = (data?.faqs ?? []).filter(isGuestFaq);
  const hostFaqs = (data?.faqs ?? []).filter(isHostFaq);

  return (
    <div className="bg-background min-h-screen">
      <MarketingPublicPageHero
        eyebrow="Support"
        title="Answers for guests and hosts"
        description={
          <>
            Short answers for the booking workflow you see in the product. Still stuck?{' '}
            <Link to="/contact" className="text-brand-ink font-medium hover:underline">
              Contact us
            </Link>
            .
          </>
        }
        blobPosition="right"
        narrow
      />

      <MarketingPublicPageContent narrow>
        {isPending ? (
          <div className="space-y-10 md:space-y-16" aria-hidden>
            {[0, 1].map((section) => (
              <div key={section}>
                <Skeleton className="h-7 w-32" />
                <div className="mt-6 space-y-5 md:mt-8 md:space-y-7">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <SupportFaqSection
              title="Guests"
              items={toFaqItems(guestFaqs)}
              fallback={fallbackGuestFaqs}
            />
            <SupportFaqSection
              title="Hosts"
              items={toFaqItems(hostFaqs)}
              fallback={fallbackHostFaqs}
              className="mt-10 md:mt-16"
            />
          </>
        )}

        <MarketingPublicCallout
          variant="inset"
          className="mt-10 md:mt-14"
          icon={LifeBuoy}
          title="Need a person?"
          body={
            <>
              Email{' '}
              <a
                href={`mailto:${PLATFORM_CONTACT_EMAIL}`}
                className="text-brand-ink font-medium hover:underline"
              >
                {PLATFORM_CONTACT_EMAIL}
              </a>{' '}
              or use the contact page.
            </>
          }
          actions={
            <>
              <Button variant="outline" className="min-h-[44px] rounded-full" asChild>
                <Link to="/contact">Contact</Link>
              </Button>
              <Button
                className="bg-primary-strong hover:bg-primary/90 min-h-[44px] rounded-full text-white"
                asChild
              >
                <Link to="/for-hosts">
                  For hosts
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </>
          }
        />
      </MarketingPublicPageContent>
    </div>
  );
}
