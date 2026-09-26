import { useCallback } from 'react';

import { ScrollText, Search } from 'lucide-react';

import {
  AdminListPagination,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminAuditBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import { useAdminListPaginationParams } from '@/features/dashboard/super-admin/hooks/useAdminListPaginationParams';
import { useSuperAdminAudit } from '@/features/dashboard/super-admin/hooks/useSuperAdminAudit';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { buildPageItems } from '@/lib/table/pagination';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SuperAdminAuditPage() {
  const { searchParams, setSearchParams, page, limit, setPage, setLimit } =
    useAdminListPaginationParams();
  const q = searchParams.get('q') ?? '';

  const { data, isLoading, isFetching, error } = useSuperAdminAudit({ page, limit, q });
  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

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
      title="Audit log"
      subtitle="Every super-admin mutation: plan assigns, verification decisions, payout disbursements, AI settings, credit adjustments."
      isLoading={isLoading && !data}
      loadingBody={<SuperAdminAuditBodySkeleton />}
      error={error}
      errorMessage="Could not load the audit log."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search actions…"
            className="h-10 pl-9"
            aria-label="Search audit log"
          />
        </div>
        <AdminListPerPageSelect limit={limit} onChange={setLimit} />
      </div>

      {events.length === 0 ? (
        <SuperAdminEmptyState
          icon={ScrollText}
          title={q ? 'No matching actions' : 'No actions recorded yet'}
        />
      ) : (
        <>
          <ol className="space-y-2">
            {events.map((event) => (
              <li key={event.id}>
                <Card padding="sm" className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{event.summary}</p>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {relativeTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    <span className="font-mono">{event.action}</span> · {event.actorEmail}
                    {event.targetType ? ` · ${event.targetType}` : ''}
                  </p>
                </Card>
              </li>
            ))}
          </ol>

          <p className="text-muted-foreground text-xs sm:text-sm">
            Showing {events.length} of {total}
          </p>

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Audit log pagination"
              page={page}
              pageCount={pageCount}
              pageItems={buildPageItems(page, pageCount)}
              isLoading={isLoading || isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </SuperAdminPage>
  );
}
