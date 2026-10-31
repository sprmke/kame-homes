import { useMemo } from 'react';

import { PublicPageCard } from '@/features/dashboard/custom-pages/components/PublicPageCard';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { orgPropertyCardModel } from '@/features/dashboard/org/lib/orgPropertyCardModel';
import { buildPropertyGuestPublicPages } from '@/features/dashboard/property/lib/propertyGuestPublicPages';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';

/** Shared card grid: 1 col mobile, 2 from sm, 3 from lg — both gallery sections. */
const PUBLIC_PAGE_CARD_GRID_CLASS =
  'grid list-none gap-3 p-0 sm:grid-cols-2 sm:items-stretch sm:gap-4 lg:grid-cols-3';

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

  const editablePages = useMemo(() => pages.filter((page) => page.editable), [pages]);
  const staticPages = useMemo(() => pages.filter((page) => !page.editable), [pages]);

  return (
    <AdminMobilePage
      title="Public Pages"
      subtitle="Every guest URL for this listing."
      titleId="public-pages-heading"
    >
      <div className="flex flex-col gap-8 sm:gap-10">
        {editablePages.length > 0 ? (
          <section aria-labelledby="public-pages-design-heading">
            <h2
              id="public-pages-design-heading"
              className="text-foreground mb-3 text-sm font-semibold tracking-tight sm:mb-4"
            >
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
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {staticPages.length > 0 ? (
          <section aria-labelledby="public-pages-other-heading">
            <h2
              id="public-pages-other-heading"
              className="text-foreground mb-3 text-sm font-semibold tracking-tight sm:mb-4"
            >
              Other guest pages
            </h2>
            <ul className={PUBLIC_PAGE_CARD_GRID_CLASS}>
              {staticPages.map((page) => (
                <li key={page.id} className="h-full">
                  <PublicPageCard
                    page={page}
                    propertyName={propertyName}
                    coverUrl={coverUrl}
                    variant="static"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AdminMobilePage>
  );
}
