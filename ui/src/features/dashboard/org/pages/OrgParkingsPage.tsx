import { useCallback, useMemo, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import { Plus } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { RequireAdmin } from '@/features/dashboard/bookings/components/RequireAdmin';
import { AddParkingDialog } from '@/features/dashboard/org/components/AddParkingDialog';
import {
  orgListingGridClassName,
  orgListingStackClassName,
} from '@/features/dashboard/org/components/OrgListingToolbar';
import {
  OrgParkingCard,
  OrgParkingListRow,
  OrgParkingsEmptyState,
} from '@/features/dashboard/org/components/org-parkings/OrgParkingCard';
import { OrgParkingsSummaryCards } from '@/features/dashboard/org/components/org-parkings/OrgParkingsSummaryCards';
import { OrgParkingsTable } from '@/features/dashboard/org/components/org-parkings/OrgParkingsTable';
import { OrgParkingsToolbar } from '@/features/dashboard/org/components/org-parkings/OrgParkingsToolbar';
import { useOrgListingPagination } from '@/features/dashboard/org/hooks/useOrgListingPagination';
import { useOrgListingSkeletonView } from '@/features/dashboard/org/hooks/useOrgListingSkeletonView';
import { useOrgListingViewMode } from '@/features/dashboard/org/hooks/useOrgListingViewMode';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import { sliceOrgListingPage } from '@/features/dashboard/org/lib/orgListingPagination';
import {
  filterOrgParkings,
  orgParkingsHasActiveFilters,
  type OrgParkingsFilters,
} from '@/features/dashboard/org/lib/orgParkingsFilters';
import {
  parkingSectionPath,
  setLastParkingContext,
} from '@/features/dashboard/org/lib/tenantPaths';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { hasOrgPermission } from '@/features/dashboard/team/lib/orgPermissions';

import { FloatingToolbar } from '@/components/mobile/FloatingPanel';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import {
  MobileHeroActionMenu,
  type MobileHeroActionMenuItem,
} from '@/components/mobile/MobileHeroActionButton';
import { OrgListingPageSkeleton } from '@/components/skeletons/OrgListingSkeleton';
import { Button } from '@/components/ui/button';
import { useIsBelowLg } from '@/hooks/useMediaQuery';

export function OrgParkingsPage() {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const isMobileLayout = useIsBelowLg();
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const { data: parkingsData, isLoading: parkingsLoading } = useParkings(orgSlug);
  const { data: orgAccess } = useOrgPermissions();
  const canCreateParkings = hasOrgPermission(orgAccess?.permissions, 'org:parkings:create');

  const [addOpen, setAddOpen] = useState(false);
  const [filters, setFilters] = useState<OrgParkingsFilters>({
    search: '',
    status: 'all',
    type: 'all',
  });

  const skeletonView = useOrgListingSkeletonView('parkings');

  const org = orgsData?.organizations.find((entry) => entry.slug === orgSlug);
  const parkings = parkingsData?.parkings ?? [];
  const { viewMode, onViewModeChange } = useOrgListingViewMode(
    parkings.length,
    parkingsLoading,
    orgSlug,
    { hideTable: isMobileLayout }
  );

  const filteredParkings = useMemo(() => filterOrgParkings(parkings, filters), [parkings, filters]);

  const filterKey = `${filters.search}|${filters.status}|${filters.type}`;
  const pagination = useOrgListingPagination(filteredParkings.length, filterKey);
  const pageParkings = useMemo(
    () =>
      sliceOrgListingPage(filteredParkings, {
        page: pagination.page,
        limit: pagination.limit,
      }),
    [filteredParkings, pagination.page, pagination.limit]
  );

  const hasActiveFilters = orgParkingsHasActiveFilters(filters);
  const isLoading = orgsLoading || parkingsLoading;
  const showPagination = filteredParkings.length > 0 && pagination.pageCount > 1;

  const onSearchChange = useCallback((search: string) => {
    setFilters((current) => ({ ...current, search }));
  }, []);

  const heroMenuItems = useMemo(() => {
    const items: MobileHeroActionMenuItem[] = [];
    if (canCreateParkings) {
      items.push({
        key: 'add-parking',
        label: 'Add parking',
        Icon: Plus,
        onSelect: () => setAddOpen(true),
      });
    }
    return items;
  }, [canCreateParkings]);

  const heroTrailing =
    heroMenuItems.length > 0 ? (
      <MobileHeroActionMenu items={heroMenuItems} label="Parking actions" />
    ) : undefined;

  const desktopActions = canCreateParkings ? (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <Button type="button" onClick={() => setAddOpen(true)} className="min-h-[44px] gap-1.5">
        <Plus className="size-4" aria-hidden />
        Add parking
      </Button>
    </div>
  ) : undefined;

  return (
    <RequireAdmin>
      <AdminMobilePage
        title="Parkings"
        subtitle="All parking slots in your organization."
        titleId="org-parkings-heading"
        heroTrailing={heroTrailing}
        desktopActions={desktopActions}
        dense
      >
        {isLoading ? (
          <OrgListingPageSkeleton view={skeletonView} label="Loading parkings" />
        ) : !org ? (
          <p className="text-muted-foreground text-sm">Organization not found.</p>
        ) : (
          <>
            <OrgParkingsSummaryCards parkings={parkings} />

            <FloatingToolbar>
              <OrgParkingsToolbar
                filters={filters}
                viewMode={viewMode}
                limit={pagination.limit}
                hideTableView={isMobileLayout}
                onSearchChange={onSearchChange}
                onStatusChange={(status) => setFilters((current) => ({ ...current, status }))}
                onTypeChange={(type) => setFilters((current) => ({ ...current, type }))}
                onViewModeChange={onViewModeChange}
                onLimitChange={pagination.setLimit}
              />
            </FloatingToolbar>

            {filteredParkings.length > 0 ? (
              <>
                {viewMode === 'table' && !isMobileLayout ? (
                  <OrgParkingsTable parkings={pageParkings} orgSlug={org.slug} />
                ) : null}

                {viewMode === 'grid' ? (
                  <div className={orgListingGridClassName}>
                    {pageParkings.map((parking) => (
                      <OrgParkingCard key={parking.id} parking={parking} orgSlug={org.slug} />
                    ))}
                  </div>
                ) : null}

                {viewMode === 'list' ? (
                  <div className={orgListingStackClassName}>
                    {pageParkings.map((parking) => (
                      <OrgParkingListRow key={parking.id} parking={parking} orgSlug={org.slug} />
                    ))}
                  </div>
                ) : null}

                {showPagination ? (
                  <AdminListPagination
                    ariaLabel="Parkings pagination"
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    pageItems={pagination.pageItems}
                    onPageChange={pagination.setPage}
                  />
                ) : null}
              </>
            ) : (
              <OrgParkingsEmptyState
                filtered={hasActiveFilters}
                canAdd={canCreateParkings}
                onAdd={() => setAddOpen(true)}
              />
            )}
          </>
        )}
      </AdminMobilePage>

      {org && orgSlug ? (
        <AddParkingDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          orgId={org.id}
          orgSlug={orgSlug}
          orgName={org.name}
          onCreated={(parking) => {
            setLastParkingContext(org.slug, parking.slug);
            navigate(parkingSectionPath(org.slug, parking.slug, 'settings'));
          }}
        />
      ) : null}
    </RequireAdmin>
  );
}
