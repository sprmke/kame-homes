import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useLocation, useParams } from 'react-router-dom';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { isOrgAdminPath } from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { ListingContractRenewalModal } from '@/features/dashboard/org/components/listing-authorization/ListingContractRenewalModal';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import {
  collectListingContractRenewalCandidates,
  pickListingContractRenewalCandidate,
  type ListingContractRenewalCandidate,
} from '@/features/dashboard/org/lib/listingContractRenewalCandidates';
import {
  isListingContractRenewalModalDismissible,
  isOnListingRenewalShell,
  shouldAutoOpenLockedListingRenewal,
} from '@/features/dashboard/org/lib/listingContractRenewalDismissScope';
import {
  clearLegacyOrgRenewalSessionStorage,
  markOrgRenewalAutoShownThisLogin,
  readOrgRenewalAutoShownThisLogin,
} from '@/features/dashboard/org/lib/listingContractRenewalSession';
import { todayManilaYmd } from '@/features/dashboard/org/lib/orgVerification';

// Pulls in submitted-doc previews (pdfjs-dist) — this provider is mounted eagerly by
// AdminLayout, so defer the import until the modal actually opens.
const ListingVerificationModal = lazy(() =>
  import('@/features/dashboard/org/components/listing-authorization/ListingVerificationModal').then(
    (m) => ({ default: m.ListingVerificationModal })
  )
);

type ListingContractRenewalContextValue = {
  setListingVerificationModalOpen: (open: boolean) => void;
};

const ListingContractRenewalContext = createContext<ListingContractRenewalContextValue | null>(
  null
);

export function useListingContractRenewalContext(): ListingContractRenewalContextValue {
  const ctx = useContext(ListingContractRenewalContext);
  if (!ctx) {
    return { setListingVerificationModalOpen: () => {} };
  }
  return ctx;
}

function useCurrentOrganization() {
  const { data } = useOrganizations();
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  const slug = orgSlug ?? orgContext?.org.slug ?? parkingContext?.org.slug;
  const bySlug = data?.organizations.find((entry) => entry.slug === slug);
  return bySlug ?? orgContext?.org ?? parkingContext?.org ?? null;
}

type ProviderProps = {
  children: ReactNode;
};

export function ListingContractRenewalProvider({ children }: ProviderProps) {
  const location = useLocation();
  const { session } = useAdminSession();
  const userId = session?.user?.id ?? null;
  const org = useCurrentOrganization();
  const propertyCtx = useOptionalOrgContext();
  const parkingCtx = useOptionalParkingContext();
  const orgSlug = org?.slug;
  const today = todayManilaYmd();
  const propertiesQuery = useProperties(orgSlug);
  const parkingsQuery = useParkings(orgSlug);

  const [activeCandidate, setActiveCandidate] = useState<ListingContractRenewalCandidate | null>(
    null
  );
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [renewalVerificationOpen, setRenewalVerificationOpen] = useState(false);
  const [sidebarVerificationOpen, setSidebarVerificationOpen] = useState(false);

  const dismissibleAutoOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    clearLegacyOrgRenewalSessionStorage();
  }, []);

  const setListingVerificationModalOpen = useCallback((open: boolean) => {
    setSidebarVerificationOpen(open);
  }, []);

  const contextValue = useMemo(
    () => ({ setListingVerificationModalOpen }),
    [setListingVerificationModalOpen]
  );

  const isOwner = org?.accessKind === 'owner';
  const listsReady = propertiesQuery.isSuccess && parkingsQuery.isSuccess;

  const candidates = useMemo(() => {
    if (!isOwner || !listsReady) return [];
    return collectListingContractRenewalCandidates(
      propertiesQuery.data?.properties ?? [],
      parkingsQuery.data?.parkings ?? [],
      today
    );
  }, [isOwner, listsReady, propertiesQuery.data?.properties, parkingsQuery.data?.parkings, today]);

  const topCandidate = useMemo(() => pickListingContractRenewalCandidate(candidates), [candidates]);

  const currentListingKind = parkingCtx ? 'parking' : propertyCtx?.property ? 'property' : null;
  const currentListingId = parkingCtx?.parking?.id ?? propertyCtx?.property?.id;

  const routeContext = useMemo(() => {
    const pathname = location.pathname;
    const isOrgOnlyRoute = isOrgAdminPath(pathname);
    const isOnAffectedListingShell = topCandidate
      ? isOnListingRenewalShell(topCandidate, currentListingKind, currentListingId)
      : false;
    return { isOrgOnlyRoute, isOnAffectedListingShell };
  }, [location.pathname, topCandidate, currentListingKind, currentListingId]);

  const effectiveDismissible = useMemo(() => {
    if (!activeCandidate) return true;
    return isListingContractRenewalModalDismissible(activeCandidate, routeContext);
  }, [activeCandidate, routeContext]);

  const anyListingVerificationOpen = sidebarVerificationOpen || renewalVerificationOpen;

  useEffect(() => {
    dismissibleAutoOpenedRef.current = null;
  }, [org?.id, today, userId]);

  useEffect(() => {
    if (!org || !isOwner || !listsReady || !userId) return;

    if (anyListingVerificationOpen) {
      setRenewalOpen(false);
      return;
    }

    const candidate = topCandidate;
    if (!candidate) {
      setActiveCandidate(null);
      setRenewalOpen(false);
      return;
    }

    setActiveCandidate(candidate);

    const shownThisLogin = readOrgRenewalAutoShownThisLogin(userId, org.id, today);

    if (candidate.phase === 'locked') {
      if (shouldAutoOpenLockedListingRenewal(routeContext, shownThisLogin)) {
        setRenewalOpen(true);
      }
      return;
    }

    if (shownThisLogin) return;

    const autoKey = `${userId}:${org.id}:${today}:${candidate.listingKind}:${candidate.listingId}`;
    if (dismissibleAutoOpenedRef.current === autoKey) return;

    setRenewalOpen(true);
    dismissibleAutoOpenedRef.current = autoKey;
    markOrgRenewalAutoShownThisLogin(userId, org.id, today);
  }, [
    org,
    isOwner,
    listsReady,
    topCandidate,
    today,
    anyListingVerificationOpen,
    userId,
    routeContext,
  ]);

  const openVerificationFromRenewal = () => {
    setRenewalOpen(false);
    setRenewalVerificationOpen(true);
  };

  const handleRenewalOpenChange = (open: boolean) => {
    if (activeCandidate && !effectiveDismissible && !open) return;
    setRenewalOpen(open);
    if (!open && org && userId && effectiveDismissible) {
      markOrgRenewalAutoShownThisLogin(userId, org.id, today);
    }
  };

  const showRenewalModal =
    Boolean(org && isOwner && activeCandidate) && renewalOpen && !anyListingVerificationOpen;

  return (
    <ListingContractRenewalContext.Provider value={contextValue}>
      {children}
      {org && isOwner && activeCandidate ? (
        <>
          <ListingContractRenewalModal
            open={showRenewalModal}
            onOpenChange={handleRenewalOpenChange}
            dismissible={effectiveDismissible}
            phase={activeCandidate.phase}
            listingKind={activeCandidate.listingKind}
            listingId={activeCandidate.listingId}
            orgId={org.id}
            listingName={activeCandidate.listingName}
            contractEndYmd={activeCandidate.contractEndDate}
            lifecycle={activeCandidate.lifecycle}
            onSubmitRenewal={openVerificationFromRenewal}
          />
          <Suspense fallback={null}>
            <ListingVerificationModal
              open={renewalVerificationOpen}
              onOpenChange={setRenewalVerificationOpen}
              orgId={org.id}
              orgSlug={org.slug}
              listingKind={activeCandidate.listingKind}
              listingId={activeCandidate.listingId}
              listingName={activeCandidate.listingName}
              listingSettings={activeCandidate.listingSettings}
              isOwner
            />
          </Suspense>
        </>
      ) : null}
    </ListingContractRenewalContext.Provider>
  );
}
