import { Link } from 'react-router-dom';

import { ArrowRight, LifeBuoy } from 'lucide-react';

import { MarketingPublicCallout } from '@/features/guest/marketing/shared/components/MarketingPublicCallout';
import {
  MarketingPublicFaqList,
  type MarketingPublicFaqItem,
} from '@/features/guest/marketing/shared/components/MarketingPublicFaqList';
import { MarketingPublicPageContent } from '@/features/guest/marketing/shared/components/MarketingPublicPageContent';
import { MarketingPublicPageHero } from '@/features/guest/marketing/shared/components/MarketingPublicPageHero';

import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { PLATFORM_CONTACT_EMAIL } from '@/lib/platformBranding';

const guestFaqs: MarketingPublicFaqItem[] = [
  {
    question: 'What happens after I submit a booking form?',
    answer:
      'Your stay enters host review. You may be asked for documents (ID, payment receipt, pet or parking papers). When requirements are met, the booking moves toward check-in, then check-out, and finally security-deposit refund if one was collected.',
  },
  {
    question: 'Where do I upload IDs or receipts?',
    answer:
      'Use the booking form or the follow-up links in your email for that property. Upload only what the host requests for your stay.',
  },
  {
    question: 'How do security deposit refunds work?',
    answer:
      'After check-out, eligible stays open a security-deposit refund form. You provide bank or GCash payout details; the host processes the refund through the booking workflow.',
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

const hostFaqs: MarketingPublicFaqItem[] = [
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
      'Pending review → documents → ready for check-in → ready for check-out → security-deposit refund → completed, plus cancel when needed. Email and related automations run through the shared workflow.',
  },
  {
    question: 'Where is pricing explained?',
    answer: (
      <>
        See{' '}
        <Link to="/for-hosts/pricing" className="text-brand-ink font-medium hover:underline">
          host pricing
        </Link>
        —free for one property, with upgrades from the dashboard when you add listings, parking, or
        team members.
      </>
    ),
  },
];

export function SupportPage() {
  usePageTitle(publicPageTitle('Support'));
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
        <MarketingPublicFaqList title="Guests" items={guestFaqs} />
        <MarketingPublicFaqList title="Hosts" items={hostFaqs} className="mt-10 md:mt-16" />

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
