import { useCallback, useMemo, useState } from 'react';

import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';

import { Building, Car, Search, Users } from 'lucide-react';

import {
  AdminListPagination,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import {
  OrgPropertiesEmptyState,
  OrgPropertyCard,
  OrgPropertyListRow,
} from '@/features/dashboard/org/components/org-properties/OrgPropertyCard';
import {
  ORG_PROPERTY_STATUSES,
  ORG_PROPERTY_TYPES,
} from '@/features/dashboard/org/lib/orgPropertyDisplay';
import { SuperAdminDetailHeader } from '@/features/dashboard/super-admin/components/shared/SuperAdminDetailHeader';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import {
  SuperAdminHostOrgCard,
  SuperAdminHostOrgsEmptyState,
} from '@/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostOrgCard';
import { useAdminListPaginationParams } from '@/features/dashboard/super-admin/hooks/useAdminListPaginationParams';
import {
  useHost,
  useHostOrganizations,
  useHostProperties,
} from '@/features/dashboard/super-admin/hooks/useHosts';
import { hostPropertyToProperty } from '@/features/dashboard/super-admin/lib/hostPropertyAdapter';
import { hostDisplayInitial } from '@/features/dashboard/super-admin/lib/superAdminHostsFilters';
import type { SuperAdminListViewMode } from '@/features/dashboard/super-admin/lib/superAdminListViewMode';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { StatCard } from '@/components/shared/StatCard';
import {
  AdminPageHeaderSkeleton,
  HostOrgCardGridSkeleton,
  ListingCardGridSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminMobileGridViewGuard } from '@/hooks/useAdminMobileGridViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { buildPageItems } from '@/lib/table/pagination';

type HostHubMode = 'organizations' | 'properties';

export function SuperAdminHostShell() {
  const { hostId = '' } = useParams<{ hostId: string }>();
  const { data: host, isLoading, error } = useHost(hostId);
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, setPage, setLimit } = useAdminListPaginationParams();

  const mode: HostHubMode =
    searchParams.get('mode') === 'properties' ? 'properties' : 'organizations';
  const q = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const type = searchParams.get('type') ?? 'all';
  const orgFilter = searchParams.get('org') ?? 'all';
  const [viewMode, setViewMode] = useState<SuperAdminListViewMode>('grid');
  const isMobileLayout = useIsBelowLg();
  useAdminMobileGridViewGuard(isMobileLayout, viewMode, setViewMode);

  // Every org this host owns — backs the org filter dropdown (and its own count) regardless of
  // which pagination page the Organizations list is currently on.
  const { data: allOrgs } = useHostOrganizations(hostId, 1, 100);
  const orgOptions = allOrgs?.rows ?? [];

  const organizationsQuery = useHostOrganizations(
    hostId,
    page,
    limit,
    mode === 'organizations' ? q : ''
  );
  const propertiesQuery = useHostProperties(hostId, {
    page,
    limit,
    q: mode === 'properties' ? q : '',
    status,
    type,
    orgId: orgFilter,
  });

  const activeQuery = mode === 'organizations' ? organizationsQuery : propertiesQuery;
  const rows = activeQuery.data?.rows ?? [];
  const total = activeQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageItems = useMemo(() => buildPageItems(page, pageCount), [page, pageCount]);

  const properties = useMemo(
    () =>
      mode === 'properties' ? (propertiesQuery.data?.rows.map(hostPropertyToProperty) ?? []) : [],
    [mode, propertiesQuery.data]
  );

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (!value || value === 'all') sp.delete(key);
            else sp.set(key, value);
          }
          sp.delete('page');
          return sp;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleModeChange = (nextMode: HostHubMode) => updateParams({ mode: nextMode, q: null });

  if (!hostId) {
    return <Navigate to={superAdminPaths.hosts} replace />;
  }
  if (isLoading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <AdminPageHeaderSkeleton compact card />
        <SuperAdminAdminListBodySkeleton metricCount={3} />
      </div>
    );
  }
  if (error || !host) {
    return <p className="text-destructive text-sm">Host not found.</p>;
  }

  const initial = hostDisplayInitial(host.name, host.email);
  const showTableView = viewMode === 'table' && !isMobileLayout;
  const showOrgFilter = mode === 'properties' && orgOptions.length > 1;

  return (
    <div className="space-y-3 sm:space-y-4">
      <SuperAdminDetailHeader
        title={host.name}
        subtitle={host.email || undefined}
        backTo={{ to: superAdminPaths.hosts, label: 'Hosts' }}
        leading={
          host.avatarUrl ? (
            <img
              src={host.avatarUrl}
              alt=""
              className="size-10 rounded-full object-cover"
              width={40}
              height={40}
            />
          ) : (
            <div className="gradient-primary text-primary-foreground flex size-10 items-center justify-center rounded-full text-sm font-bold">
              {initial}
            </div>
          )
        }
      />

      <section aria-label="Host summary" className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:gap-4">
        <StatCard
          title="Organizations"
          value={String(host.stats.organizationCount)}
          icon={Users}
          iconClassName="text-sky-600 dark:text-sky-400"
          iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
          active={mode === 'organizations'}
          onClick={() => handleModeChange('organizations')}
        />
        <StatCard
          title="Properties"
          value={String(host.stats.propertyCount)}
          icon={Building}
          iconClassName="text-violet-600 dark:text-violet-400"
          iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
          active={mode === 'properties'}
          onClick={() => handleModeChange('properties')}
        />
        <StatCard
          title="Parking slots"
          value={String(host.stats.parkingCount)}
          icon={Car}
          iconClassName="text-amber-600 dark:text-amber-400"
          iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
        />
      </section>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[min(100%,16rem)] flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(event) => updateParams({ q: event.target.value || null })}
            placeholder={mode === 'organizations' ? 'Search organizations…' : 'Search properties…'}
            className="h-10 pl-9"
            aria-label={mode === 'organizations' ? 'Search organizations' : 'Search properties'}
          />
        </div>

        <Select value={mode} onValueChange={(value) => handleModeChange(value as HostHubMode)}>
          <SelectTrigger className="h-10 w-[10.5rem] shrink-0" aria-label="View">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="organizations">Organizations</SelectItem>
            <SelectItem value="properties">Properties</SelectItem>
          </SelectContent>
        </Select>

        {showOrgFilter ? (
          <Select value={orgFilter} onValueChange={(value) => updateParams({ org: value })}>
            <SelectTrigger className="h-10 w-[11rem] shrink-0" aria-label="Filter by organization">
              <SelectValue placeholder="All organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {orgOptions.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {mode === 'properties' ? (
          <>
            <Select value={status} onValueChange={(value) => updateParams({ status: value })}>
              <SelectTrigger className="h-10 w-[9rem] shrink-0" aria-label="Filter by status">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {ORG_PROPERTY_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(value) => updateParams({ type: value })}>
              <SelectTrigger className="h-10 w-[9rem] shrink-0" aria-label="Filter by type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ORG_PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <AdminListPerPageSelect limit={limit} onChange={setLimit} />
          <SuperAdminListViewToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            hideTableView={isMobileLayout}
          />
        </div>
      </div>

      {activeQuery.isLoading ? (
        mode === 'organizations' ? (
          <HostOrgCardGridSkeleton count={6} />
        ) : (
          <ListingCardGridSkeleton count={8} label="Loading properties" />
        )
      ) : activeQuery.error ? (
        <p className="text-destructive text-sm">
          Could not load {mode === 'organizations' ? 'organizations' : 'properties'}.
        </p>
      ) : mode === 'organizations' ? (
        rows.length === 0 ? (
          <SuperAdminHostOrgsEmptyState />
        ) : showTableView ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Properties</TableHead>
                    <TableHead>Parking</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizationsQuery.data?.rows.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <Link
                          to={superAdminPaths.organizationHub(org.slug)}
                          className="font-medium hover:underline"
                        >
                          {org.name}
                        </Link>
                        <div className="text-muted-foreground text-xs">/{org.slug}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">{org.stats.propertyCount}</TableCell>
                      <TableCell className="tabular-nums">{org.stats.parkingCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organizationsQuery.data?.rows.map((org) => (
              <SuperAdminHostOrgCard key={org.id} organization={org} />
            ))}
          </div>
        )
      ) : properties.length === 0 ? (
        <OrgPropertiesEmptyState
          filtered={Boolean(q || status !== 'all' || type !== 'all' || orgFilter !== 'all')}
          canAdd={false}
          onAdd={() => {}}
        />
      ) : showTableView ? (
        <div className="space-y-3">
          {propertiesQuery.data?.rows.map((property, index) => (
            <OrgPropertyListRow
              key={property.id}
              property={properties[index]!}
              orgSlug={property.organizationSlug}
              organizationName={property.organizationName}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {propertiesQuery.data?.rows.map((property, index) => (
            <OrgPropertyCard
              key={property.id}
              property={properties[index]!}
              orgSlug={property.organizationSlug}
              organizationName={property.organizationName}
            />
          ))}
        </div>
      )}

      {total > 0 ? (
        <p className="text-muted-foreground text-xs sm:text-sm">
          Showing {rows.length} of {total}
        </p>
      ) : null}

      {pageCount > 1 ? (
        <AdminListPagination
          ariaLabel={
            mode === 'organizations' ? 'Organizations pagination' : 'Properties pagination'
          }
          page={page}
          pageCount={pageCount}
          pageItems={pageItems}
          isLoading={activeQuery.isLoading || activeQuery.isFetching}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
