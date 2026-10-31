import { useCallback, useEffect, useRef, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { LifeBuoy, Mail } from 'lucide-react';

import { GUEST_ACCOUNT_TICKETS_PATH } from '@/features/guest/account/lib/guestAccountPaths';
import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import { PublicContactCategoryGrid } from '@/features/guest/marketing/contact/components/PublicContactCategoryGrid';
import {
  parsePublicContactCategory,
  publicContactPath,
} from '@/features/guest/marketing/contact/lib/publicContactParams';
import { MarketingPublicPageContent } from '@/features/guest/marketing/shared/components/MarketingPublicPageContent';
import { MarketingPublicPageHero } from '@/features/guest/marketing/shared/components/MarketingPublicPageHero';
import { MarketingPublicSectionHeading } from '@/features/guest/marketing/shared/components/MarketingPublicSectionHeading';

import { NewTicketModal } from '@/features/dashboard/help-support/components/NewTicketModal';
import { SupportTicketScopeProvider } from '@/features/dashboard/help-support/context/SupportTicketScopeContext';
import type { SupportTicketCategory } from '@/features/dashboard/help-support/lib/supportTicketSchema';
import { MANAGED_PLAN_INQUIRY_SUBJECT } from '@/features/dashboard/plans/lib/planPresentation';

import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { PLATFORM_CONTACT_EMAIL } from '@/lib/platformBranding';

const GUEST_TICKET_SCOPE = {
  channel: 'guest' as const,
  orgSlug: null,
  orgId: null,
  propertyId: null,
  parkingId: null,
};

function resolveDefaultSubject(searchParams: URLSearchParams): string | undefined {
  const subject = searchParams.get('subject')?.trim();
  if (subject) return subject;
  if (searchParams.get('category') === 'business_inquiry') {
    return MANAGED_PLAN_INQUIRY_SUBJECT;
  }
  return undefined;
}

export function ContactPage() {
  usePageTitle(publicPageTitle('Contact'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { status } = useGuestSession();
  const { requireGuestAuth } = useGuestAuth();
  const ready = status !== 'loading';
  const isAuthenticated = status === 'authenticated';

  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SupportTicketCategory | undefined>();
  const [defaultSubject, setDefaultSubject] = useState<string | undefined>();
  const autoOpenedRef = useRef(false);

  const clearContactParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('category');
    next.delete('subject');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openTicketFlow = useCallback(
    (category: SupportTicketCategory, subject?: string) => {
      setSelectedCategory(category);
      setDefaultSubject(subject);

      if (!ready) return;

      if (isAuthenticated) {
        setTicketModalOpen(true);
        return;
      }

      const contactPath = publicContactPath({ category, subject });
      requireGuestAuth(() => setTicketModalOpen(true), {
        resume: { type: 'navigate', to: contactPath },
      });
    },
    [isAuthenticated, ready, requireGuestAuth]
  );

  const handleCategorySelect = (category: SupportTicketCategory) => {
    openTicketFlow(category);
  };

  useEffect(() => {
    if (!ready || autoOpenedRef.current) return;

    const category = parsePublicContactCategory(searchParams.get('category'));
    if (!category) return;

    autoOpenedRef.current = true;
    openTicketFlow(category, resolveDefaultSubject(searchParams));
  }, [openTicketFlow, ready, searchParams]);

  const handleTicketSubmitted = (ticketId: string) => {
    setTicketModalOpen(false);
    clearContactParams();
    navigate(`${GUEST_ACCOUNT_TICKETS_PATH}/${ticketId}`);
  };

  const handleTicketModalOpenChange = (open: boolean) => {
    setTicketModalOpen(open);
    if (!open) {
      clearContactParams();
      setSelectedCategory(undefined);
      setDefaultSubject(undefined);
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <MarketingPublicPageHero
        eyebrow="Contact"
        title="Send us a message"
        description="Pick what your message is about. Sign in with your explore account to open a ticket."
        blobPosition="right"
        narrow
      />

      <MarketingPublicPageContent narrow>
        <PublicContactCategoryGrid onSelect={handleCategorySelect} />

        <div className="border-border bg-muted/40 public-card-pad mt-6 rounded-2xl border md:mt-10">
          <MarketingPublicSectionHeading
            title="Booking as a guest?"
            description="For stay questions, try Support first or email us with your booking ID."
            titleClassName="text-xl sm:text-xl"
          />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="min-h-[44px] rounded-full" asChild>
              <Link to="/support">
                <LifeBuoy className="mr-2 h-4 w-4" aria-hidden />
                Support
              </Link>
            </Button>
            <Button variant="outline" className="min-h-[44px] rounded-full" asChild>
              <a href={`mailto:${PLATFORM_CONTACT_EMAIL}?subject=Guest%20support`}>
                <Mail className="mr-2 h-4 w-4" aria-hidden />
                {PLATFORM_CONTACT_EMAIL}
              </a>
            </Button>
          </div>
        </div>
      </MarketingPublicPageContent>

      <SupportTicketScopeProvider scope={GUEST_TICKET_SCOPE}>
        <NewTicketModal
          open={ticketModalOpen}
          onOpenChange={handleTicketModalOpenChange}
          onSubmitted={handleTicketSubmitted}
          defaultCategory={selectedCategory}
          defaultSubject={defaultSubject}
        />
      </SupportTicketScopeProvider>
    </div>
  );
}
