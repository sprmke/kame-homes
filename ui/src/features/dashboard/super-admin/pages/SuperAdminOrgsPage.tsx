import { useCallback } from 'react';

import { Link } from 'react-router-dom';

import { Building, Building2, Car, ChevronRight, Search } from 'lucide-react';

import {
  AdminListPagination,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import { useAdminListPaginationParams } from '@/features/dashboard/super-admin/hooks/useAdminListPaginationParams';
import {
  useSuperAdminOrgs,
  useSuperAdminOrgsSummary,
  type SuperAdminOrgRow,
} from '@/features/dashboard/super-admin/hooks/useSuperAdminOrgs';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buildPageItems } from '@/lib/table/pagination';

function PlanBadge({ row }: { row: SuperAdminOrgRow }) {
  if (!row.planCode) {
    return <span className="text-muted-foreground text-xs">No plan</span>;
  }
  return (
    <Badge variant={row.subscriptionStatus === 'active' ? 'secondary' : 'outline'}>
      {row.planName ?? row.planCode}
    </Badge>
  );
}

export function SuperAdminOrgsPage() {
  const { searchParams, setSearchParams, page, limit, setPage, setLimit } =
    useAdminListPaginationParams();
  const q = searchParams.get('q') ?? '';

  const { data, isLoading, isFetching, error } = useSuperAdminOrgs({ q, plan: 'all', page, limit });
  const { data: summary } = useSuperAdminOrgsSummary();

  const rows = data?.organizations ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageItems = buildPageItems(page, pageCount);

  const setSearch = useCallback(
    (value: string) =>
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (value) sp.set('q', value);
          else sp.delete('q');
          sp.delete('page');
          return sp;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  return (
    <SuperAdminPage
      title="Organizations"
      subtitle="Every organization on the platform. Open one to manage its subscription, listings, team, approvals, and support in one place."
      isLoading={isLoading && !data}
      loadingMetricCount={4}
      error={error}
      errorMessage="Could not load organizations."
    >
      <section
        aria-label="Organization summary"
        className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <StatCard
          title="Organizations"
          value={String(summary?.total ?? total)}
          icon={Building2}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
        />
        <StatCard
          title="With a plan"
          value={String(summary?.subscribed ?? '-')}
          icon={Building2}
          iconClassName="text-sky-600 dark:text-sky-400"
          iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
        />
        <StatCard
          title="Properties"
          value={String(summary?.properties ?? '-')}
          icon={Building}
          iconClassName="text-violet-600 dark:text-violet-400"
          iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
        />
        <StatCard
          title="Parkings"
          value={String(summary?.parkings ?? '-')}
          icon={Car}
          iconClassName="text-amber-600 dark:text-amber-400"
          iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
        />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search organizations…"
            className="h-10 pl-9"
            aria-label="Search organizations"
          />
        </div>
        <AdminListPerPageSelect limit={limit} onChange={setLimit} />
      </div>

      {rows.length === 0 ? (
        <SuperAdminEmptyState
          icon={Building2}
          title={q ? 'No organizations match your search' : 'No organizations yet'}
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Listings</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="cursor-pointer">
                      <TableCell>
                        <Link
                          to={superAdminPaths.organizationHub(row.slug)}
                          className="font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                        <div className="text-muted-foreground text-xs">/{row.slug}</div>
                      </TableCell>
                      <TableCell>
                        <PlanBadge row={row} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.propertyCount} prop · {row.parkingCount} parking
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {row.mrrPhp > 0 ? `₱${row.mrrPhp.toLocaleString('en-PH')}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={superAdminPaths.organizationHub(row.slug)}
                          aria-label={`Open ${row.name}`}
                        >
                          <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <Link key={row.id} to={superAdminPaths.organizationHub(row.slug)} className="block">
                <Card padding="sm" className="hover:border-primary/40 space-y-2 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{row.name}</div>
                      <div className="text-muted-foreground text-xs">/{row.slug}</div>
                    </div>
                    <PlanBadge row={row} />
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {row.propertyCount} properties · {row.parkingCount} parkings
                    {row.mrrPhp > 0 ? ` · ₱${row.mrrPhp.toLocaleString('en-PH')} MRR` : ''}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <p className="text-muted-foreground text-xs sm:text-sm">
            Showing {rows.length} of {total}
          </p>

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Organizations pagination"
              page={page}
              pageCount={pageCount}
              pageItems={pageItems}
              isLoading={isLoading || isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </SuperAdminPage>
  );
}
