import { Building, Car } from 'lucide-react';

import { OrgParkingCard } from '@/features/dashboard/org/components/org-parkings/OrgParkingCard';
import { OrgPropertyCard } from '@/features/dashboard/org/components/org-properties/OrgPropertyCard';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { useSuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';

import { ListingCardGridSkeleton } from '@/components/skeletons/AdminSkeletons';

export function SuperAdminOrgListingsSection() {
  const { slug } = useSuperAdminOrgContext();
  const propertiesQuery = useProperties(slug);
  const parkingsQuery = useParkings(slug);

  const properties = propertiesQuery.data?.properties ?? [];
  const parkings = parkingsQuery.data?.parkings ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-section-title flex items-center gap-2">
          <Building className="size-4" aria-hidden />
          Properties ({properties.length})
        </h2>
        {propertiesQuery.isLoading ? (
          <ListingCardGridSkeleton count={4} label="Loading properties" />
        ) : properties.length === 0 ? (
          <SuperAdminEmptyState icon={Building} title="No properties" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {properties.map((property) => (
              <OrgPropertyCard key={property.id} property={property} orgSlug={slug} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-section-title flex items-center gap-2">
          <Car className="size-4" aria-hidden />
          Parkings ({parkings.length})
        </h2>
        {parkingsQuery.isLoading ? (
          <ListingCardGridSkeleton count={4} label="Loading parkings" />
        ) : parkings.length === 0 ? (
          <SuperAdminEmptyState icon={Car} title="No parkings" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {parkings.map((parking) => (
              <OrgParkingCard key={parking.id} parking={parking} orgSlug={slug} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
