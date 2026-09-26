import { type ReactNode, useMemo } from 'react';

import {
  ProvideOrgContext,
  type OrgContextValue,
} from '@/features/dashboard/org/components/RequireOrgContext';
import {
  ProvideParkingContext,
  type ParkingContextValue,
} from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import { useSetupGuide } from '@/features/dashboard/setup-guide/components/setupGuideContext';

type PropertyHostProps = {
  propertyId: string;
  children: ReactNode;
  loadingFallback: ReactNode;
};

/** Mount property-scoped settings hooks outside the property route shell. */
export function SetupGuidePropertyHost({
  propertyId,
  children,
  loadingFallback,
}: PropertyHostProps) {
  const { org } = useSetupGuide();
  const orgSlug = org?.slug;
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const { data: propsData, isLoading: propsLoading } = useProperties(orgSlug);

  const value = useMemo((): OrgContextValue | null => {
    if (!orgSlug || !org) return null;
    const resolvedOrg =
      orgsData?.organizations.find((entry) => entry.id === org.id || entry.slug === orgSlug) ?? org;
    const property = propsData?.properties.find((entry) => entry.id === propertyId);
    if (!property) return null;
    return {
      org: resolvedOrg,
      property,
      orgSlug: resolvedOrg.slug,
      propertySlug: property.slug,
    };
  }, [org, orgSlug, orgsData, propsData, propertyId]);

  if (orgsLoading || propsLoading) {
    return loadingFallback;
  }

  if (!value) {
    return <p className="text-muted-foreground text-sm">Property not found.</p>;
  }

  return <ProvideOrgContext value={value}>{children}</ProvideOrgContext>;
}

type ParkingHostProps = {
  parkingId: string;
  children: ReactNode;
  loadingFallback: ReactNode;
};

/** Mount parking-scoped settings hooks outside the parking route shell. */
export function SetupGuideParkingHost({ parkingId, children, loadingFallback }: ParkingHostProps) {
  const { org } = useSetupGuide();
  const orgSlug = org?.slug;
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const { data: parkingsData, isLoading: parkingsLoading } = useParkings(orgSlug);

  const value = useMemo((): ParkingContextValue | null => {
    if (!orgSlug || !org) return null;
    const resolvedOrg =
      orgsData?.organizations.find((entry) => entry.id === org.id || entry.slug === orgSlug) ?? org;
    const parking = parkingsData?.parkings.find((entry) => entry.id === parkingId);
    if (!parking) return null;
    return {
      org: resolvedOrg,
      parking,
      orgSlug: resolvedOrg.slug,
      parkingSlug: parking.slug,
    };
  }, [org, orgSlug, orgsData, parkingsData, parkingId]);

  if (orgsLoading || parkingsLoading) {
    return loadingFallback;
  }

  if (!value) {
    return <p className="text-muted-foreground text-sm">Parking not found.</p>;
  }

  return <ProvideParkingContext value={value}>{children}</ProvideParkingContext>;
}
