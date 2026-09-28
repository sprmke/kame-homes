import { useMemo, useState, useEffect, useCallback } from 'react';

import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { CopyPlus, Plus } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { RequireAdmin } from '@/features/dashboard/bookings/components/RequireAdmin';
import { AddPropertyDialog } from '@/features/dashboard/org/components/AddPropertyDialog';
import {
  CopyPropertySettingsDialog,
  type CopyPropertySettingsDialogProperty,
} from '@/features/dashboard/org/components/org-properties/CopyPropertySettingsDialog';
import { CopyPropertySettingsHistory } from '@/features/dashboard/org/components/org-properties/CopyPropertySettingsHistory';
import {
  orgListingGridClassName,
  orgListingStackClassName,
} from '@/features/dashboard/org/components/OrgListingToolbar';
import { OrgPropertiesSummaryCards } from '@/features/dashboard/org/components/org-properties/OrgPropertiesSummaryCards';
import { OrgPropertiesTable } from '@/features/dashboard/org/components/org-properties/OrgPropertiesTable';
import { OrgPropertiesToolbar } from '@/features/dashboard/org/components/org-properties/OrgPropertiesToolbar';
import {
  OrgPropertiesEmptyState,
  OrgPropertyCard,
  OrgPropertyListRow,
} from '@/features/dashboard/org/components/org-properties/OrgPropertyCard';
import { useOrgListingPagination } from '@/features/dashboard/org/hooks/useOrgListingPagination';
import { useOrgListingSkeletonView } from '@/features/dashboard/org/hooks/useOrgListingSkeletonView';
import { useOrgListingViewMode } from '@/features/dashboard/org/hooks/useOrgListingViewMode';
import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { sliceOrgListingPage } from '@/features/dashboard/org/lib/orgListingPagination';
import {
  filterOrgProperties,
  orgPropertiesHasActiveFilters,
  type OrgPropertiesFilters,
} from '@/features/dashboard/org/lib/orgPropertiesFilters';
import {
  propertySectionPath,
  setLastTenantContext,
} from '@/features/dashboard/org/lib/tenantPaths';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
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

export function OrgPropertiesPage() {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobileLayout = useIsBelowLg();
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const { data: propsData, isLoading: propsLoading } = useProperties(orgSlug);
  const { data: orgAccess } = useOrgPermissions();
  const canCreateProperties = hasOrgPermission(orgAccess?.permissions, 'org:properties:create');

  const [addOpen, setAddOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySourcePropertyId, setCopySourcePropertyId] = useState<string | null>(null);
  const [copyLockedTargetId, setCopyLockedTargetId] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrgPropertiesFilters>({
    search: '',
    status: 'all',
    type: 'all',
  });

  const skeletonView = useOrgListingSkeletonView('properties');

  const org = orgsData?.organizations.find((entry) => entry.slug === orgSlug);
  const properties = propsData?.properties ?? [];
  const { viewMode, onViewModeChange } = useOrgListingViewMode(
    properties.length,
    propsLoading,
    orgSlug,
    { hideTable: isMobileLayout }
  );

  const filteredProperties = useMemo(
    () => filterOrgProperties(properties, filters),
    [properties, filters]
  );

  const filterKey = `${filters.search}|${filters.status}|${filters.type}`;
  const pagination = useOrgListingPagination(filteredProperties.length, filterKey);
  const pageProperties = useMemo(
    () =>
      sliceOrgListingPage(filteredProperties, {
        page: pagination.page,
        limit: pagination.limit,
      }),
    [filteredProperties, pagination.page, pagination.limit]
  );

  const hasActiveFilters = orgPropertiesHasActiveFilters(filters);
  const isLoading = orgsLoading || propsLoading;
  const canCopySettings = properties.length >= 2;
  const showPagination = filteredProperties.length > 0 && pagination.pageCount > 1;

  const onSearchChange = useCallback((search: string) => {
    setFilters((current) => ({ ...current, search }));
  }, []);

  const copyDialogProperties = useMemo<CopyPropertySettingsDialogProperty[]>(
    () =>
      properties.map((property) => ({
        id: property.id,
        name: property.name,
        tower: property.tower,
        unitNumber: property.unitNumber,
        status: property.status,
      })),
    [properties]
  );

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of properties) {
      map.set(property.id, property.name);
    }
    return map;
  }, [properties]);

  const openCopySettings = (sourcePropertyId?: string | null, lockedTargetId?: string | null) => {
    setCopySourcePropertyId(sourcePropertyId ?? null);
    setCopyLockedTargetId(lockedTargetId ?? null);
    setCopyOpen(true);
  };

  useEffect(() => {
    const copyTarget = searchParams.get('copyTarget')?.trim();
    if (!copyTarget || properties.length < 2) return;
    if (!properties.some((p) => p.id === copyTarget)) return;
    openCopySettings(null, copyTarget);
    const next = new URLSearchParams(searchParams);
    next.delete('copyTarget');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from query
  }, [properties, searchParams]);

  const heroMenuItems = useMemo(() => {
    const items: MobileHeroActionMenuItem[] = [];
    if (canCopySettings) {
      items.push({
        key: 'copy-settings',
        label: 'Copy settings',
        Icon: CopyPlus,
        onSelect: () => openCopySettings(properties[0]?.id ?? null),
      });
    }
    if (canCreateProperties) {
      items.push({
        key: 'add-property',
        label: 'Add property',
        Icon: Plus,
        onSelect: () => setAddOpen(true),
      });
    }
    return items;
  }, [canCopySettings, canCreateProperties, properties]);

  const heroTrailing =
    heroMenuItems.length > 0 ? (
      <MobileHeroActionMenu items={heroMenuItems} label="Property actions" />
    ) : undefined;

  const desktopActions =
    canCreateProperties || canCopySettings ? (
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {canCopySettings ? (
          <TierBadgeAnchor feature="copyPropertySettings">
            <Button
              type="button"
              variant="outline"
              onClick={() => openCopySettings(properties[0]?.id ?? null)}
              className="min-h-[44px] gap-1.5"
            >
              <CopyPlus className="size-4" aria-hidden />
              Copy settings
            </Button>
          </TierBadgeAnchor>
        ) : null}
        {canCreateProperties ? (
          <Button type="button" onClick={() => setAddOpen(true)} className="min-h-[44px] gap-1.5">
            <Plus className="size-4" aria-hidden />
            Add property
          </Button>
        ) : null}
      </div>
    ) : undefined;

  return (
    <RequireAdmin>
      <AdminMobilePage
        title="Properties"
        subtitle="All properties in your organization."
        titleId="org-properties-heading"
        heroTrailing={heroTrailing}
        desktopActions={desktopActions}
        dense
      >
        {isLoading ? (
          <OrgListingPageSkeleton view={skeletonView} label="Loading properties" />
        ) : !org ? (
          <p className="text-muted-foreground text-sm">Organization not found.</p>
        ) : (
          <>
            <OrgPropertiesSummaryCards properties={properties} />

            <FloatingToolbar>
              <OrgPropertiesToolbar
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

            {filteredProperties.length > 0 ? (
              <>
                {viewMode === 'table' && !isMobileLayout ? (
                  <OrgPropertiesTable
                    properties={pageProperties}
                    orgSlug={org.slug}
                    onCopySettings={canCopySettings ? openCopySettings : undefined}
                  />
                ) : null}

                {viewMode === 'grid' ? (
                  <div className={orgListingGridClassName}>
                    {pageProperties.map((property) => (
                      <OrgPropertyCard
                        key={property.id}
                        property={property}
                        orgSlug={org.slug}
                        onCopySettings={canCopySettings ? openCopySettings : undefined}
                      />
                    ))}
                  </div>
                ) : null}

                {viewMode === 'list' ? (
                  <div className={orgListingStackClassName}>
                    {pageProperties.map((property) => (
                      <OrgPropertyListRow
                        key={property.id}
                        property={property}
                        orgSlug={org.slug}
                        onCopySettings={canCopySettings ? openCopySettings : undefined}
                      />
                    ))}
                  </div>
                ) : null}

                {showPagination ? (
                  <AdminListPagination
                    ariaLabel="Properties pagination"
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    pageItems={pagination.pageItems}
                    onPageChange={pagination.setPage}
                  />
                ) : null}
              </>
            ) : (
              <OrgPropertiesEmptyState
                filtered={hasActiveFilters}
                canAdd={canCreateProperties}
                onAdd={() => setAddOpen(true)}
              />
            )}

            <CopyPropertySettingsHistory orgSlug={org.slug} propertyNameById={propertyNameById} />
          </>
        )}
      </AdminMobilePage>

      {org ? (
        <AddPropertyDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          orgId={org.id}
          orgSlug={org.slug}
          orgName={org.name}
          onCreated={(property) => {
            setLastTenantContext(org.slug, property.slug);
            navigate(propertySectionPath(org.slug, property.slug, 'settings'));
          }}
        />
      ) : null}

      {org && canCopySettings ? (
        <CopyPropertySettingsDialog
          open={copyOpen}
          onOpenChange={(open) => {
            setCopyOpen(open);
            if (!open) setCopyLockedTargetId(null);
          }}
          orgSlug={org.slug}
          properties={copyDialogProperties}
          initialSourcePropertyId={copySourcePropertyId}
          lockedTargetPropertyId={copyLockedTargetId}
        />
      ) : null}
    </RequireAdmin>
  );
}
