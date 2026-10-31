import * as React from 'react';

import { Search, Sparkles } from 'lucide-react';

import {
  AdminListPagination,
  AdminListPerPageSelect,
} from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { AiAssignDialog } from '@/features/dashboard/super-admin/components/super-admin-ai/AiAssignDialog';
import { AiOrgLimitsSheet } from '@/features/dashboard/super-admin/components/super-admin-ai/AiOrgLimitsSheet';
import { AiOverrideDialog } from '@/features/dashboard/super-admin/components/super-admin-ai/AiOverrideDialog';
import { useAdminListPaginationParams } from '@/features/dashboard/super-admin/hooks/useAdminListPaginationParams';
import {
  useAiLimitsMatrix,
  useAiLimitsProfiles,
  type AiLimitsMatrixFilters,
  type AiLimitsMatrixRow,
} from '@/features/dashboard/super-admin/hooks/useSuperAdminAiLimits';
import { formatLimitValue } from '@/features/dashboard/super-admin/lib/aiLimits';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buildPageItems } from '@/lib/table/pagination';
import { cn } from '@/lib/utils';

const ALL = 'all';
const STATUS_OPTIONS: Array<{ value: AiLimitsMatrixFilters['status']; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'breach', label: 'At limit' },
  { value: 'overridden', label: 'Overridden' },
  { value: 'disabled', label: 'AI off' },
];

function profileOf(row: AiLimitsMatrixRow): string {
  return row.orgProfileCode ?? row.planProfileCode ?? 'default';
}

function Flags({ row }: { row: AiLimitsMatrixRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.breach ? <Badge variant="destructive">At limit</Badge> : null}
      {row.hasOverrides ? (
        <Badge variant="outline" title={row.overrideReason ?? undefined}>
          Override
        </Badge>
      ) : null}
      {!row.aiEnabled ? <Badge variant="secondary">AI off</Badge> : null}
    </div>
  );
}

function usageText(used: number, limit: number | null, key: 'dailyCallLimit' | 'monthlyCallLimit') {
  return `${used.toLocaleString('en-US')} / ${formatLimitValue(key, limit)}`;
}

export function AiLimitsTab() {
  const { searchParams, setSearchParams, page, limit, setPage, setLimit } =
    useAdminListPaginationParams();
  const search = searchParams.get('q') ?? '';
  const planTier = searchParams.get('plan') ?? '';
  const profileCode = searchParams.get('profile') ?? '';
  const status = (searchParams.get('status') ?? 'all') as AiLimitsMatrixFilters['status'];

  const filters: AiLimitsMatrixFilters = {
    search,
    planTier,
    profileCode,
    status,
    limit,
    offset: (page - 1) * limit,
  };
  const { data, isLoading, isFetching, error } = useAiLimitsMatrix(filters);
  const { data: profilesData } = useAiLimitsProfiles();

  // id -> name, so a selection can span pages.
  const [selected, setSelected] = React.useState<Map<string, string>>(new Map());
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [overrideOpen, setOverrideOpen] = React.useState(false);
  const [openOrgId, setOpenOrgId] = React.useState<string | null>(null);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const selectedTargets = Array.from(selected, ([id, name]) => ({ id, name }));
  const allOnPage = rows.length > 0 && rows.every((row) => selected.has(row.organizationId));

  const setParam = (key: string, value: string) =>
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (value && value !== ALL) sp.set(key, value);
        else sp.delete(key);
        sp.delete('page');
        return sp;
      },
      { replace: true }
    );

  const toggle = (row: AiLimitsMatrixRow, on: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      if (on) next.set(row.organizationId, row.name);
      else next.delete(row.organizationId);
      return next;
    });
  const togglePage = (on: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      for (const row of rows) {
        if (on) next.set(row.organizationId, row.name);
        else next.delete(row.organizationId);
      }
      return next;
    });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder="Search organizations…"
            className="h-10 pl-9"
            aria-label="Search organizations"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
          <Select value={planTier || ALL} onValueChange={(v) => setParam('plan', v)}>
            <SelectTrigger className="h-10 lg:w-36" aria-label="Filter by plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All plans</SelectItem>
              {(data?.planTiers ?? []).map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {tier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={profileCode || ALL} onValueChange={(v) => setParam('profile', v)}>
            <SelectTrigger className="h-10 lg:w-36" aria-label="Filter by profile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All profiles</SelectItem>
              {(profilesData?.profiles ?? []).map((profile) => (
                <SelectItem key={profile.id} value={profile.code}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setParam('status', v)}>
            <SelectTrigger className="h-10 lg:w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="lg:ml-auto">
          <AdminListPerPageSelect limit={limit} onChange={setLimit} />
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="bg-primary/5 border-primary/20 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button type="button" size="sm" onClick={() => setAssignOpen(true)}>
            Assign profile
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setOverrideOpen(true)}>
            Set overrides
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Map())}>
            Clear
          </Button>
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="space-y-2" aria-label="Loading organizations">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">Could not load AI limits.</p>
      ) : rows.length === 0 ? (
        <SuperAdminEmptyState icon={Sparkles} title="No organizations match" />
      ) : (
        <>
          <Card className={cn('hidden overflow-hidden lg:block', isFetching && 'opacity-70')}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPage}
                        onCheckedChange={(v) => togglePage(v === true)}
                        aria-label="Select all on page"
                      />
                    </TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Today calls</TableHead>
                    <TableHead>Month calls</TableHead>
                    <TableHead>Month cost</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.organizationId}
                      data-state={selected.has(row.organizationId) ? 'selected' : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(row.organizationId)}
                          onCheckedChange={(v) => toggle(row, v === true)}
                          aria-label={`Select ${row.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left font-medium hover:underline"
                          onClick={() => setOpenOrgId(row.organizationId)}
                        >
                          {row.name}
                        </button>
                        <div className="text-muted-foreground text-xs">/{row.slug}</div>
                      </TableCell>
                      <TableCell className="text-sm capitalize">{row.planTier}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{profileOf(row)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {usageText(
                          row.usage.todayCalls,
                          row.limits.dailyCallLimit.value,
                          'dailyCallLimit'
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {usageText(
                          row.usage.monthCalls,
                          row.limits.monthlyCallLimit.value,
                          'monthlyCallLimit'
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        ${row.usage.monthCostUsd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {Math.round(row.usage.monthCredits).toLocaleString('en-US')} /{' '}
                        {formatLimitValue(
                          'monthlyCreditLimit',
                          row.limits.monthlyCreditLimit.value
                        )}
                      </TableCell>
                      <TableCell>
                        <Flags row={row} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className={cn('space-y-2 lg:hidden', isFetching && 'opacity-70')}>
            {rows.map((row) => (
              <Card key={row.organizationId} padding="sm" className="space-y-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selected.has(row.organizationId)}
                    onCheckedChange={(v) => toggle(row, v === true)}
                    aria-label={`Select ${row.name}`}
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenOrgId(row.organizationId)}
                  >
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="text-muted-foreground text-xs capitalize">
                      {row.planTier}
                      {profileOf(row) !== row.planTier ? ` · ${profileOf(row)}` : ''}
                    </div>
                  </button>
                  <Flags row={row} />
                </div>
                <div className="text-muted-foreground grid grid-cols-2 gap-2 pl-7 text-xs tabular-nums">
                  <span>
                    Today{' '}
                    {usageText(
                      row.usage.todayCalls,
                      row.limits.dailyCallLimit.value,
                      'dailyCallLimit'
                    )}
                  </span>
                  <span>Month ${row.usage.monthCostUsd.toFixed(2)}</span>
                </div>
              </Card>
            ))}
          </div>

          <p className="text-muted-foreground text-xs sm:text-sm">
            Showing {rows.length} of {total}
            {data?.truncated ? ' (first 1,000 organizations)' : ''}
          </p>
          {pageCount > 1 ? (
            <AdminListPagination
              ariaLabel="AI limits pagination"
              page={page}
              pageCount={pageCount}
              pageItems={buildPageItems(page, pageCount)}
              isLoading={isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <AiAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        scope="organization"
        targets={selectedTargets}
        profiles={profilesData?.profiles ?? []}
        onDone={() => setSelected(new Map())}
      />
      <AiOverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        scope="organization"
        targets={selectedTargets}
        onDone={() => setSelected(new Map())}
      />
      <AiOrgLimitsSheet orgId={openOrgId} onOpenChange={(open) => !open && setOpenOrgId(null)} />
    </div>
  );
}
