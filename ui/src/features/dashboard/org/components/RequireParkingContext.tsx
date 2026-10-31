import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { Navigate, useParams } from 'react-router-dom';

import { TenantAccessDenied } from '@/features/dashboard/org/components/TenantAccessDenied';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import { setLastParkingContext } from '@/features/dashboard/org/lib/tenantPaths';
import type { Organization, Parking } from '@/features/dashboard/org/types';

import { RouteGuardLoading } from '@/components/skeletons/RouteGuardLoading';

export type ParkingContextValue = {
  org: Organization;
  parking: Parking;
  orgSlug: string;
  parkingSlug: string;
};

const ParkingContext = createContext<ParkingContextValue | null>(null);

export function useParkingContext(): ParkingContextValue {
  const ctx = useContext(ParkingContext);
  if (!ctx) {
    throw new Error('useParkingContext must be used within RequireParkingContext');
  }
  return ctx;
}

export function useOptionalParkingContext(): ParkingContextValue | null {
  return useContext(ParkingContext);
}

/** Provide parking scope outside the normal route shell (e.g. Setup Guide). */
export function ProvideParkingContext({
  value,
  children,
}: {
  value: ParkingContextValue;
  children: ReactNode;
}) {
  return <ParkingContext.Provider value={value}>{children}</ParkingContext.Provider>;
}

type Props = {
  children: ReactNode;
};

export function RequireParkingContext({ children }: Props) {
  const { orgSlug, parkingSlug } = useParams<{
    orgSlug: string;
    parkingSlug: string;
  }>();

  const orgsQuery = useOrganizations();
  const parkingsQuery = useParkings(orgSlug);

  const value = useMemo(() => {
    if (!orgSlug || !parkingSlug) return null;
    const org = orgsQuery.data?.organizations.find((o) => o.slug === orgSlug);
    const parking = parkingsQuery.data?.parkings.find((p) => p.slug === parkingSlug);
    if (!org || !parking) return null;
    return { org, parking, orgSlug, parkingSlug };
  }, [orgSlug, parkingSlug, orgsQuery.data, parkingsQuery.data]);

  useEffect(() => {
    if (value) {
      setLastParkingContext(value.orgSlug, value.parkingSlug);
    }
  }, [value]);

  if (orgsQuery.isLoading || parkingsQuery.isLoading) {
    return <RouteGuardLoading fullScreen />;
  }

  if (!orgSlug || !parkingSlug) {
    return <Navigate to="/org" replace />;
  }

  if (orgsQuery.isError) {
    return <TenantAccessDenied scope="org" orgSlug={orgSlug} />;
  }

  const org = orgsQuery.data?.organizations.find((o) => o.slug === orgSlug);
  if (!org) {
    return <TenantAccessDenied scope="org" orgSlug={orgSlug} />;
  }

  if (parkingsQuery.isError) {
    return (
      <TenantAccessDenied
        scope="property"
        orgSlug={orgSlug}
        orgName={org.name}
        propertySlug={parkingSlug}
      />
    );
  }

  const parking = parkingsQuery.data?.parkings.find((p) => p.slug === parkingSlug);
  if (!parking) {
    return (
      <TenantAccessDenied
        scope="property"
        orgSlug={orgSlug}
        orgName={org.name}
        propertySlug={parkingSlug}
      />
    );
  }

  const contextValue = { org, parking, orgSlug, parkingSlug };

  return <ParkingContext.Provider value={contextValue}>{children}</ParkingContext.Provider>;
}
