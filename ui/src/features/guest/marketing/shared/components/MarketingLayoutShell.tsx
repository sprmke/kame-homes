import { Suspense, useEffect } from 'react';

import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { scrollToSection } from '@/features/guest/marketing/for-hosts/lib/scrollToSection';
import { MarketingBottomNav } from '@/features/guest/marketing/shared/components/MarketingBottomNav';
import { MarketingFooter } from '@/features/guest/marketing/shared/components/MarketingFooter';
import { MarketingNav } from '@/features/guest/marketing/shared/components/MarketingNav';
import { ListingScrollSearchProvider } from '@/features/guest/marketing/shared/context/ListingScrollSearchContext';
import { getListingScrollSearchConfig } from '@/features/guest/marketing/shared/lib/listingScrollSearchPaths';
import { getListingSearchDefaultLocation } from '@/features/guest/marketing/shared/lib/listingSearchDefaultLocation';
import {
  getListingSearchFields,
  getListingSearchWhereSegment,
} from '@/features/guest/marketing/shared/lib/listingSearchFields';

import { BottomBarSlotProvider } from '@/components/mobile/BottomBarSlot';
import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { SectionLoadingFallback } from '@/components/routing/RouteFallback';
import { useFavicon } from '@/lib/favicon';
import { APP_TITLE, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

function isFocusedGuestFlowRoute(pathname: string) {
  if (/^\/parkings\/requests\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/parkings\/[^/]+\/form\/?$/.test(pathname)) return true;
  return false;
}

export function MarketingLayoutShell() {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const isFormPage = isFocusedGuestFlowRoute(pathname);
  const scrollSearchConfig = getListingScrollSearchConfig(pathname);
  const defaultLocation = getListingSearchDefaultLocation(pathname);
  const fields = getListingSearchFields(pathname);
  const whereSegment = getListingSearchWhereSegment(pathname);

  useEffect(() => {
    if (pathname === '/for-hosts' && hash === '#pricing') {
      navigate('/for-hosts/pricing', { replace: true });
      return;
    }
    if (!hash) return;
    const id = hash.replace(/^#/, '');
    if (!id) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (el) {
        scrollToSection(id, reduceMotion);
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        window.setTimeout(tryScroll, 50);
      }
    };

    const frame = window.requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [pathname, hash, navigate]);

  usePageTitle(APP_TITLE || undefined);
  useFavicon(undefined);

  const page = (
    <div
      className={cn(
        'relative flex min-h-screen flex-col',
        !isFormPage && bottomTabBarOffsetClassName()
      )}
    >
      {!isFormPage && <MarketingNav />}
      {/* Footer committed together with the route content (not as an eager sibling) —
          otherwise it paints at its "nothing loaded yet" position first and gets
          shoved down once the lazy page chunk resolves, which is a large,
          highly-visible layout shift (CLS) on first load. */}
      <Suspense fallback={<SectionLoadingFallback />}>
        <main className="flex-1">
          <Outlet />
        </main>
        {!isFormPage && <MarketingFooter />}
      </Suspense>
    </div>
  );

  const shell = isFormPage ? (
    page
  ) : (
    <BottomBarSlotProvider tabBar={<MarketingBottomNav />}>{page}</BottomBarSlotProvider>
  );

  if (!scrollSearchConfig || isFormPage) {
    return shell;
  }

  return (
    <ListingScrollSearchProvider
      enabled
      redirectTo={scrollSearchConfig.redirectTo}
      preferType={scrollSearchConfig.preferType}
      defaultLocation={defaultLocation}
      fields={fields}
      whereLabel={whereSegment.label}
      wherePlaceholder={whereSegment.placeholder}
      whereCompactPlaceholder={whereSegment.compactPlaceholder}
    >
      {shell}
    </ListingScrollSearchProvider>
  );
}
