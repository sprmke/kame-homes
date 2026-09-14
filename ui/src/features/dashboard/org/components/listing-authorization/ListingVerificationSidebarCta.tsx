import { lazy, Suspense, useEffect, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { Home } from 'lucide-react';

import { useListingContractRenewalContext } from '@/features/dashboard/org/components/listing-authorization/ListingContractRenewalProvider';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import {
  readListingAuthorizationSummary,
  shouldShowListingVerificationCta,
} from '@/features/dashboard/org/lib/listingAuthorization';
import { LISTING_VERIFICATION_SIDEBAR_SUBLABEL } from '@/features/dashboard/org/lib/listingVerificationCopy';
import { listingVerificationSidebarLabel } from '@/features/dashboard/org/lib/listingVerificationTiers';

import { cn } from '@/lib/utils';

// Pulls in submitted-doc previews (pdfjs-dist) — this CTA is mounted eagerly by
// AdminLayout, so defer the import until the modal actually opens.
const ListingVerificationModal = lazy(() =>
  import('@/features/dashboard/org/components/listing-authorization/ListingVerificationModal').then(
    (m) => ({ default: m.ListingVerificationModal })
  )
);

const OPEN_QUERY = 'listingVerification';

type Props = {
  collapsed?: boolean;
  variant?: 'sidebar' | 'icon';
};

export function ListingVerificationSidebarCta({ collapsed, variant = 'sidebar' }: Props) {
  const [open, setOpen] = useState(false);
  const { setListingVerificationModalOpen } = useListingContractRenewalContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyCtx = useOptionalOrgContext();
  const parkingCtx = useOptionalParkingContext();

  const listingKind = parkingCtx ? 'parking' : propertyCtx ? 'property' : null;
  const listing = parkingCtx?.parking ?? propertyCtx?.property ?? null;
  const org = parkingCtx?.org ?? propertyCtx?.org ?? null;

  const setVerificationOpen = (next: boolean) => {
    setOpen(next);
  };

  useEffect(() => {
    setListingVerificationModalOpen(open);
    return () => setListingVerificationModalOpen(false);
  }, [open, setListingVerificationModalOpen]);

  useEffect(() => {
    if (searchParams.get(OPEN_QUERY) === 'open' && listing && org) {
      setVerificationOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete(OPEN_QUERY);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, listing, org, setSearchParams]);

  if (!listingKind || !listing || !org) return null;

  const authorization = readListingAuthorizationSummary(listing.settings);
  if (!shouldShowListingVerificationCta(authorization) && authorization.baseStatus === 'none') {
    // Always show for owners so they can start Tier 1
  }

  const isOwner = org.accessKind === 'owner';
  if (!isOwner) return null;

  const label = listingVerificationSidebarLabel(authorization);

  const modal = (
    <Suspense fallback={null}>
      <ListingVerificationModal
        open={open}
        onOpenChange={setVerificationOpen}
        orgId={org.id}
        orgSlug={org.slug}
        listingKind={listingKind}
        listingId={listing.id}
        listingName={listing.name}
        listingSettings={listing.settings}
        isOwner={isOwner}
      />
    </Suspense>
  );

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          onClick={() => setVerificationOpen(true)}
          title={label}
          aria-label={label}
          className="border-primary/25 from-primary/[0.12] to-primary/[0.04] text-primary hover:from-primary/15 hover:to-primary/[0.08] flex size-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br shadow-sm transition-colors"
        >
          <Home className="size-4 shrink-0" aria-hidden />
        </button>
        {modal}
      </>
    );
  }

  return (
    <>
      <div
        className={cn('border-sidebar-border shrink-0 border-t py-3', collapsed ? 'px-2' : 'px-3')}
      >
        <button
          type="button"
          onClick={() => setVerificationOpen(true)}
          title={collapsed ? label : undefined}
          className={cn(
            'border-primary/25 from-primary/[0.12] to-primary/[0.04] text-primary hover:from-primary/15 hover:to-primary/[0.08] flex min-h-[44px] w-full items-center rounded-xl border bg-gradient-to-br shadow-sm transition-colors',
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'
          )}
        >
          <span className="bg-primary/15 flex size-8 shrink-0 items-center justify-center rounded-full">
            <Home className="size-4 shrink-0" aria-hidden />
          </span>
          {!collapsed ? (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold leading-tight">{label}</span>
              {authorization.baseStatus === 'none' || authorization.baseStatus === 'rejected' ? (
                <span className="text-primary/80 mt-0.5 block truncate text-[11px] font-medium leading-tight">
                  {LISTING_VERIFICATION_SIDEBAR_SUBLABEL}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
      </div>
      {modal}
    </>
  );
}
