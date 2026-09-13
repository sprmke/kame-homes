import { useMemo, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ChevronDown, Landmark, Megaphone, Plus } from 'lucide-react';

import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPageLoading } from '@/features/dashboard/super-admin/components/shared/SuperAdminPageLoading';
import { SuperAdminAnnouncementCardGrid } from '@/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementCardGrid';
import {
  SuperAdminAnnouncementDialog,
  type SuperAdminAnnouncementDialogState,
} from '@/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementDialog';
import { SuperAdminAnnouncementSummaryCards } from '@/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementSummaryCards';
import { SuperAdminAnnouncementTable } from '@/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementTable';
import {
  SuperAdminAnnouncementResultsMeta,
  SuperAdminAnnouncementToolbar,
} from '@/features/dashboard/super-admin/components/super-admin-announcements/SuperAdminAnnouncementToolbar';
import { usePlatformHostSettings } from '@/features/dashboard/super-admin/hooks/usePlatformHostSettings';
import {
  DEFAULT_SUPER_ADMIN_ANNOUNCEMENT_FILTERS,
  filterSuperAdminAnnouncements,
  superAdminAnnouncementHasActiveFilters,
  type SuperAdminAnnouncementFilters,
  type SuperAdminAnnouncementViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminAnnouncementFilters';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAdminMobileGridViewGuard } from '@/hooks/useAdminMobileGridViewGuard';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';

function AnnouncementsEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <SuperAdminEmptyState
      icon={Megaphone}
      title={filtered ? 'No announcements match your filters' : 'No announcements yet'}
    />
  );
}

function AddAnnouncementActions({ onCreatePlatform }: { onCreatePlatform: () => void }) {
  const isMobileLayout = useIsBelowLg();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const trigger = (
    <Button type="button" size="sm" className="min-h-[44px] gap-1.5">
      <Plus className="size-4" aria-hidden />
      Add announcement
      <ChevronDown className="size-4 opacity-70" aria-hidden />
    </Button>
  );

  if (isMobileLayout) {
    return (
      <>
        <Button
          type="button"
          size="sm"
          className="min-h-[44px] gap-1.5"
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          onClick={() => setSheetOpen(true)}
        >
          <Plus className="size-4" aria-hidden />
          Add announcement
          <ChevronDown className="size-4 opacity-70" aria-hidden />
        </Button>
        <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Add announcement">
          <div role="listbox" aria-label="Add announcement">
            <MobileChoiceItem
              label="Platform announcement"
              icon={<Megaphone className="size-5" aria-hidden />}
              onSelect={() => {
                onCreatePlatform();
                setSheetOpen(false);
              }}
            />
            <MobileChoiceItem
              label="Development announcement"
              icon={<Landmark className="size-5" aria-hidden />}
              onSelect={() => {
                setSheetOpen(false);
                navigate(superAdminPaths.developments);
              }}
            />
          </div>
        </MobileChoiceSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCreatePlatform}>
          <Megaphone className="size-4" aria-hidden />
          Platform announcement
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={superAdminPaths.developments}>
            <Landmark className="size-4" aria-hidden />
            Development announcement
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SuperAdminAnnouncementsPage() {
  usePageTitle(appPageTitle('Announcements'));

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );
  const filters: SuperAdminAnnouncementFilters = {
    search: searchParams.get('search') ?? DEFAULT_SUPER_ADMIN_ANNOUNCEMENT_FILTERS.search,
    severity: (searchParams.get('severity') ??
      DEFAULT_SUPER_ADMIN_ANNOUNCEMENT_FILTERS.severity) as SuperAdminAnnouncementFilters['severity'],
    status: (searchParams.get('status') ??
      DEFAULT_SUPER_ADMIN_ANNOUNCEMENT_FILTERS.status) as SuperAdminAnnouncementFilters['status'],
  };

  const { data, isLoading } = usePlatformHostSettings();
  const [viewMode, setViewMode] = useState<SuperAdminAnnouncementViewMode>('table');
  const [dialogState, setDialogState] = useState<SuperAdminAnnouncementDialogState | null>(null);
  const isMobileLayout = useIsBelowLg();
  useAdminMobileGridViewGuard(isMobileLayout, viewMode, setViewMode);

  const allAnnouncements = data?.announcements ?? [];
  const filtered = useMemo(
    () => filterSuperAdminAnnouncements(allAnnouncements, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allAnnouncements, filters.search, filters.severity, filters.status]
  );
  const hasActiveFilters = superAdminAnnouncementHasActiveFilters(filters);
  const showTableView = viewMode === 'table' && !isMobileLayout;
  const pageCount = Math.max(1, Math.ceil(filtered.length / limit));
  const safePage = Math.min(page, pageCount);
  const pageItems = buildPageItems(safePage, pageCount);
  const pageAnnouncements = filtered.slice((safePage - 1) * limit, safePage * limit);

  const setPage = (nextPage: number) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextPage <= 1) sp.delete('page');
        else sp.set('page', String(nextPage));
        return sp;
      },
      { replace: true }
    );
  };

  const setLimit = (nextLimit: number) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (nextLimit === ADMIN_DEFAULT_PAGE_SIZE) sp.delete('limit');
        else sp.set('limit', String(nextLimit));
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );
  };

  function updateFilters(next: SuperAdminAnnouncementFilters) {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (!next.search.trim()) sp.delete('search');
        else sp.set('search', next.search);
        if (next.severity === 'all') sp.delete('severity');
        else sp.set('severity', next.severity);
        if (next.status === 'all') sp.delete('status');
        else sp.set('status', next.status);
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {isLoading ? (
        <SuperAdminPageLoading metricCount={4} />
      ) : (
        <>
          <AdminPageHeader
            title="Announcements"
            subtitle="Platform-wide notices shown to every signed-in host."
            actions={
              <AddAnnouncementActions onCreatePlatform={() => setDialogState({ mode: 'create' })} />
            }
          />

          <SuperAdminAnnouncementSummaryCards announcements={allAnnouncements} />

          <SuperAdminAnnouncementToolbar
            filters={filters}
            viewMode={viewMode}
            hideTableView={isMobileLayout}
            limit={limit}
            onSearchChange={(search) => updateFilters({ ...filters, search })}
            onSeverityChange={(severity) => updateFilters({ ...filters, severity })}
            onStatusChange={(status) => updateFilters({ ...filters, status })}
            onViewModeChange={setViewMode}
            onLimitChange={setLimit}
          />

          {pageAnnouncements.length > 0 ? (
            showTableView ? (
              <SuperAdminAnnouncementTable
                announcements={pageAnnouncements}
                onSelect={(id) => setDialogState({ mode: 'edit', id })}
              />
            ) : (
              <SuperAdminAnnouncementCardGrid
                announcements={pageAnnouncements}
                onSelect={(id) => setDialogState({ mode: 'edit', id })}
              />
            )
          ) : (
            <AnnouncementsEmptyState filtered={hasActiveFilters} />
          )}

          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="Announcements pagination"
              page={safePage}
              pageCount={pageCount}
              pageItems={pageItems}
              onPageChange={setPage}
            />
          ) : null}

          <SuperAdminAnnouncementResultsMeta
            visibleCount={pageAnnouncements.length}
            totalCount={filtered.length}
          />
        </>
      )}

      <SuperAdminAnnouncementDialog
        state={dialogState}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
      />
    </div>
  );
}
