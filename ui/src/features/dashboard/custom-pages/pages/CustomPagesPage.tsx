import { useMemo, useState } from 'react';

import { absoluteGuestPath } from '@/features/guest/lib/guestPublicPaths';

import {
  BookingLinkPickerModal,
  type BookingLinkKind,
} from '@/features/dashboard/custom-pages/components/BookingLinkPickerModal';
import { CopyLinksMenu } from '@/features/dashboard/custom-pages/components/CopyLinksMenu';
import { PublicPageCard } from '@/features/dashboard/custom-pages/components/PublicPageCard';
import {
  StayDatesLinkModal,
  type StayDatesLinkPage,
} from '@/features/dashboard/custom-pages/components/StayDatesLinkModal';
import { copyGuestLink } from '@/features/dashboard/custom-pages/lib/copyGuestLink';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { orgPropertyCardModel } from '@/features/dashboard/org/lib/orgPropertyCardModel';
import {
  buildPropertyGuestPublicPages,
  type PropertyGuestPublicPage,
} from '@/features/dashboard/property/lib/propertyGuestPublicPages';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';

/** Shared card grid: 1 col mobile, 2 from sm, 3 from lg — every gallery section. */
const PUBLIC_PAGE_CARD_GRID_CLASS =
  'grid list-none gap-3 p-0 sm:grid-cols-2 sm:items-stretch sm:gap-4 lg:grid-cols-3';

const SECTION_HEADING_CLASS = 'text-foreground mb-3 text-sm font-semibold tracking-tight sm:mb-4';

export function CustomPagesPage() {
  const orgContext = useOptionalOrgContext();
  const propertySlug = orgContext?.property.slug ?? '';
  const propertyId = usePropertyIdParam();
  const propertyName = orgContext?.property.name?.trim() || 'Property';
  const coverUrl = orgContext ? orgPropertyCardModel(orgContext.property).thumbnailUrl : null;
  const { data: access } = usePropertyPermissions();
  const canEditListing = hasPropertyPermission(access?.permissions, 'publicPages.property:edit');
  const canEditStayGuide = hasPropertyPermission(access?.permissions, 'publicPages.stayGuide:edit');
  const canEditShowcase = hasPropertyPermission(access?.permissions, 'publicPages.showcase:edit');

  const [bookingLink, setBookingLink] = useState<BookingLinkKind | null>(null);
  const [datesLink, setDatesLink] = useState<StayDatesLinkPage | null>(null);

  function canEditPage(pageId: string): boolean {
    if (pageId === 'listing') return canEditListing;
    if (pageId === 'stay-guide') return canEditStayGuide;
    if (pageId === 'showcase') return canEditShowcase;
    return false;
  }

  const pages = useMemo(() => {
    if (!propertySlug.trim() || !propertyId) return [];
    return buildPropertyGuestPublicPages(propertySlug, propertyId);
  }, [propertyId, propertySlug]);

  const editablePages = useMemo(() => pages.filter((page) => page.group === 'design'), [pages]);
  const sharePages = useMemo(() => pages.filter((page) => page.group === 'share'), [pages]);
  const bookingPages = useMemo(() => pages.filter((page) => page.group === 'booking'), [pages]);

  /** Same action for the card copy button and the header menu. */
  function runCopyAction(page: PropertyGuestPublicPage) {
    if (page.copyPicker === 'stay-dates') {
      if (page.id === 'calendar' || page.id === 'messages') setDatesLink(page.id);
      return;
    }
    if (page.copyPicker === 'sd-refund' || page.copyPicker === 'guest-review') {
      setBookingLink(page.copyPicker);
      return;
    }
    void copyGuestLink(absoluteGuestPath(page.copyPath ?? page.path), page.label);
  }

  const shareablePages = pages.filter((page) => page.guestShareable);
  const copyMenuItems = shareablePages.map((page, index) => ({
    key: page.id,
    label: page.label,
    Icon: page.icon,
    separatorBefore: index > 0 && shareablePages[index - 1]?.group !== page.group,
    onSelect: () => runCopyAction(page),
  }));

  return (
    <AdminMobilePage
      title="Public Pages"
      subtitle="Every guest URL for this listing."
      titleId="public-pages-heading"
      heroTrailing={<CopyLinksMenu items={copyMenuItems} variant="hero" />}
      desktopActions={<CopyLinksMenu items={copyMenuItems} variant="desktop" />}
    >
      <div className="flex flex-col gap-8 sm:gap-10">
        {editablePages.length > 0 ? (
          <section aria-labelledby="public-pages-design-heading">
            <h2 id="public-pages-design-heading" className={SECTION_HEADING_CLASS}>
              Design your pages
            </h2>
            <ul className={PUBLIC_PAGE_CARD_GRID_CLASS}>
              {editablePages.map((page) => (
                <li key={page.id} className="h-full">
                  <PublicPageCard
                    page={page}
                    propertyName={propertyName}
                    coverUrl={coverUrl}
                    variant="editable"
                    canEdit={canEditPage(page.id)}
                    onCopy={() => runCopyAction(page)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {sharePages.length > 0 ? (
          <section aria-labelledby="public-pages-share-heading">
            <h2 id="public-pages-share-heading" className={SECTION_HEADING_CLASS}>
              Share links
            </h2>
            <ul className={PUBLIC_PAGE_CARD_GRID_CLASS}>
              {sharePages.map((page) => (
                <li key={page.id} className="h-full">
                  <PublicPageCard
                    page={page}
                    propertyName={propertyName}
                    coverUrl={coverUrl}
                    variant="static"
                    onCopy={() => runCopyAction(page)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bookingPages.length > 0 ? (
          <section aria-labelledby="public-pages-booking-heading">
            <h2 id="public-pages-booking-heading" className={SECTION_HEADING_CLASS}>
              Booking links
            </h2>
            <ul className={PUBLIC_PAGE_CARD_GRID_CLASS}>
              {bookingPages.map((page) => (
                <li key={page.id} className="h-full">
                  <PublicPageCard
                    page={page}
                    propertyName={propertyName}
                    coverUrl={coverUrl}
                    variant="static"
                    onCopy={() => runCopyAction(page)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <BookingLinkPickerModal
        open={bookingLink !== null}
        onOpenChange={(open) => {
          if (!open) setBookingLink(null);
        }}
        propertySlug={propertySlug}
        kind={bookingLink ?? 'sd-refund'}
      />
      <StayDatesLinkModal
        open={datesLink !== null}
        onOpenChange={(open) => {
          if (!open) setDatesLink(null);
        }}
        propertySlug={propertySlug}
        pageId={datesLink ?? 'calendar'}
      />
    </AdminMobilePage>
  );
}
