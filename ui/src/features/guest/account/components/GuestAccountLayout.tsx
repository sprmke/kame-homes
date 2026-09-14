import { Suspense } from 'react';

import { Outlet, useLocation } from 'react-router-dom';

import { GuestAccountMobileNav } from '@/features/guest/account/components/GuestAccountMobileNav';
import { GuestAccountSidebar } from '@/features/guest/account/components/GuestAccountSidebar';

import { SectionLoadingFallback } from '@/components/routing/RouteFallback';
import { cn } from '@/lib/utils';

const MARKETING_HEADER_OFFSET = 'pt-16 lg:pt-24';

export function GuestAccountLayout() {
  const location = useLocation();

  return (
    <div className={cn('bg-muted/20 min-h-dvh', MARKETING_HEADER_OFFSET)}>
      <GuestAccountMobileNav
        pathname={location.pathname}
        className="sticky top-16 z-30 lg:hidden"
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex w-full gap-6 lg:gap-8 xl:gap-10">
          <aside
            className="border-sidebar-border bg-sidebar hidden w-[260px] shrink-0 self-start rounded-2xl border shadow-sm lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-hidden"
            aria-label="Account navigation"
          >
            <GuestAccountSidebar pathname={location.pathname} />
          </aside>

          <main className="w-full min-w-0 flex-1 pb-10 pt-5 sm:pb-12 sm:pt-6 lg:pb-14 lg:pt-0">
            <div className="w-full">
              <Suspense fallback={<SectionLoadingFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
