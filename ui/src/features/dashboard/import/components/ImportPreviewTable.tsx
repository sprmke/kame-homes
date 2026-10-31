import * as React from 'react';

import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import {
  ImportAlert,
  ImportStatStrip,
} from '@/features/dashboard/import/components/ImportModalChrome';
import {
  ImportRowFixSheet,
  type ImportRowFixMode,
} from '@/features/dashboard/import/components/ImportRowFixSheet';
import { useImportBatchRows } from '@/features/dashboard/import/hooks/useImportBatchRows';
import {
  useUpdateImportRow,
  type UpdateImportRowInput,
} from '@/features/dashboard/import/hooks/useUpdateImportRow';
import { formatImportRowIssueSummary } from '@/features/dashboard/import/lib/importTargetFields';
import type {
  ImportBatchRowPreview,
  ImportPreviewSummary,
} from '@/features/dashboard/import/types/importBatch';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;
type ImportPreviewStatusFilter = 'all' | 'error' | 'valid' | 'skipped' | 'warning';

type Props = {
  batchId: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

function filterRows(rows: ImportBatchRowPreview[], filter: ImportPreviewStatusFilter) {
  switch (filter) {
    case 'error':
      return rows.filter((row) => row.validationStatus === 'error');
    case 'valid':
      return rows.filter((row) => row.validationStatus === 'valid');
    case 'skipped':
      return rows.filter((row) => row.validationStatus === 'skipped');
    case 'warning':
      return rows.filter((row) =>
        row.validationErrors.some((entry) => entry.severity === 'warning')
      );
    default:
      return rows;
  }
}

function PreviewSummary({
  summary,
  filter,
  onFilterChange,
}: {
  summary: ImportPreviewSummary;
  filter: ImportPreviewStatusFilter;
  onFilterChange: (filter: ImportPreviewStatusFilter) => void;
}) {
  const toggleFilter = (next: ImportPreviewStatusFilter) => {
    onFilterChange(filter === next ? 'all' : next);
  };

  return (
    <ImportStatStrip
      stats={[
        {
          label: 'Ready',
          value: summary.valid,
          tone: 'primary',
          selected: filter === 'valid',
          onSelect: () => toggleFilter('valid'),
        },
        {
          label: 'Need fixing',
          value: summary.error,
          tone: 'danger',
          selected: filter === 'error',
          onSelect: () => toggleFilter('error'),
        },
        {
          label: 'Skipped',
          value: summary.skipped,
          tone: 'neutral',
          selected: filter === 'skipped',
          onSelect: () => toggleFilter('skipped'),
        },
        {
          label: 'Warnings',
          value: summary.warning,
          tone: 'warning',
          selected: filter === 'warning',
          onSelect: () => toggleFilter('warning'),
        },
      ]}
    />
  );
}

function rowStatusVariant(
  status: ImportBatchRowPreview['validationStatus']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'valid':
      return 'default';
    case 'error':
      return 'destructive';
    case 'skipped':
      return 'outline';
    default:
      return 'secondary';
  }
}

function rowStatusLabel(status: ImportBatchRowPreview['validationStatus']): string {
  switch (status) {
    case 'valid':
      return 'Ready';
    case 'error':
      return 'Needs fixing';
    case 'skipped':
      return 'Skipped';
    default:
      return status;
  }
}

function PreviewIssueGuidance({ errorCount }: { errorCount: number }) {
  if (errorCount <= 0) return null;

  return (
    <ImportAlert tone="warning">
      {errorCount === 1
        ? 'One row needs attention. Open it to fix or skip it.'
        : `${errorCount.toLocaleString()} rows need attention. Open a row to fix or skip it.`}
    </ImportAlert>
  );
}

function guestName(row: ImportBatchRowPreview): string {
  return row.mappedData.primary_guest_name ?? row.mappedData.guest_display_name ?? 'No name';
}

type PreviewRowProps = {
  row: ImportBatchRowPreview;
  displayIndex: number;
  isUpdating: boolean;
  onImportToggle: (rowId: string, willImport: boolean) => void;
  onFix: (rowId: string) => void;
};

function IssueCell({ row }: { row: ImportBatchRowPreview }) {
  const isError = row.validationStatus === 'error';
  const isSkipped = row.validationStatus === 'skipped';
  const hasWarning = row.validationErrors.some((entry) => entry.severity === 'warning');
  const hasBlocking = row.validationErrors.some((entry) => entry.severity === 'error');
  const { primary, extraCount } = formatImportRowIssueSummary(row);

  if (!primary) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <span
      className={cn(
        'flex items-start gap-1',
        hasWarning && row.validationStatus === 'valid' && 'text-amber-600',
        (isError || (isSkipped && hasBlocking)) && 'text-destructive'
      )}
    >
      {(isError || hasWarning || (isSkipped && hasBlocking)) && (
        <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
      )}
      <span className="line-clamp-2">
        {primary}
        {extraCount > 0 ? (
          <span className="text-muted-foreground font-normal"> · +{extraCount} more</span>
        ) : null}
      </span>
    </span>
  );
}

function PreviewRowDesktop({
  row,
  displayIndex,
  isUpdating,
  onImportToggle,
  onFix,
}: PreviewRowProps) {
  const isExcluded = row.validationStatus === 'skipped';
  const isError = row.validationStatus === 'error';
  const isImportOn = row.validationStatus === 'valid';
  const canOpenFix = isError || isExcluded;

  const handleToggle = (willImport: boolean) => {
    if (isError && willImport) return;
    onImportToggle(row.id, willImport);
  };

  return (
    <TableRow
      className={cn(
        isError && 'bg-destructive/5',
        isExcluded && 'opacity-60',
        canOpenFix && 'cursor-pointer'
      )}
      tabIndex={canOpenFix ? 0 : undefined}
      onClick={canOpenFix ? () => onFix(row.id) : undefined}
      onKeyDown={
        canOpenFix
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onFix(row.id);
              }
            }
          : undefined
      }
    >
      <TableCell className="text-muted-foreground w-10 px-2 text-xs">{displayIndex}</TableCell>
      <TableCell className="max-w-[8rem] truncate px-2 text-xs">{guestName(row)}</TableCell>
      <TableCell className="whitespace-nowrap px-2 text-xs">
        {row.mappedData.check_in_date ?? '-'}
      </TableCell>
      <TableCell className="whitespace-nowrap px-2 text-xs">
        {row.mappedData.check_out_date ?? '-'}
      </TableCell>
      <TableCell className="w-[7.5rem] px-2">
        <Badge
          variant={rowStatusVariant(row.validationStatus)}
          className="whitespace-nowrap px-2.5 text-[10px]"
        >
          {rowStatusLabel(row.validationStatus)}
        </Badge>
      </TableCell>
      <TableCell className="w-[25rem] max-w-[25rem] px-2 text-xs">
        <IssueCell row={row} />
      </TableCell>
      <TableCell className="px-2" onClick={(event) => event.stopPropagation()}>
        {isError || isExcluded ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 text-xs"
            disabled={isUpdating}
            onClick={() => onFix(row.id)}
          >
            Fix
          </Button>
        ) : (
          <Switch
            checked={isImportOn}
            disabled={isUpdating}
            aria-label={`Import row ${displayIndex}`}
            onCheckedChange={handleToggle}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

function PreviewRowMobile({
  row,
  displayIndex,
  isUpdating,
  onImportToggle,
  onFix,
}: PreviewRowProps) {
  const isExcluded = row.validationStatus === 'skipped';
  const isError = row.validationStatus === 'error';
  const isImportOn = row.validationStatus === 'valid';
  const canOpenFix = isError || isExcluded;

  const handleToggle = (willImport: boolean) => {
    if (isError && willImport) return;
    onImportToggle(row.id, willImport);
  };

  return (
    <li
      className={cn(
        'border-border/70 space-y-2 rounded-xl border px-3 py-2.5',
        isError && 'border-destructive/40 bg-destructive/5',
        isExcluded && 'opacity-60',
        canOpenFix && 'cursor-pointer'
      )}
      tabIndex={canOpenFix ? 0 : undefined}
      onClick={canOpenFix ? () => onFix(row.id) : undefined}
      onKeyDown={
        canOpenFix
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onFix(row.id);
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">
            <span className="text-muted-foreground mr-1.5 tabular-nums">#{displayIndex}</span>
            {guestName(row)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
            {row.mappedData.check_in_date ?? '-'} → {row.mappedData.check_out_date ?? '-'}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Badge
            variant={rowStatusVariant(row.validationStatus)}
            className="whitespace-nowrap px-2.5 text-[10px]"
          >
            {rowStatusLabel(row.validationStatus)}
          </Badge>
          {isError || isExcluded ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 text-xs"
              disabled={isUpdating}
              onClick={() => onFix(row.id)}
            >
              Fix
            </Button>
          ) : (
            <Switch
              checked={isImportOn}
              disabled={isUpdating}
              aria-label={`Import row ${displayIndex}`}
              onCheckedChange={handleToggle}
            />
          )}
        </div>
      </div>
      <div className="text-xs">
        <IssueCell row={row} />
      </div>
    </li>
  );
}

function PreviewPagination({
  pageStart,
  pageSize,
  total,
  safePage,
  pageCount,
  onPageChange,
}: {
  pageStart: number;
  pageSize: number;
  total: number;
  safePage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">
        {pageStart + 1}–{Math.min(pageStart + pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Previous page"
          disabled={safePage <= 0}
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="min-w-[4rem] text-center tabular-nums">
          {safePage + 1} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Next page"
          disabled={safePage >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, safePage + 1))}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function ImportPreviewTableSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Checking rows">
      <div className="divide-border/70 border-border/70 grid grid-cols-2 divide-x overflow-hidden rounded-xl border max-sm:divide-y sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted/25 space-y-1.5 px-3 py-2.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-8" />
          </div>
        ))}
      </div>

      <ul className="space-y-2 sm:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="border-border/70 space-y-2 rounded-xl border px-3 py-2.5"
            style={{ opacity: 1 - i * 0.08 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32 max-w-full" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            </div>
          </li>
        ))}
      </ul>

      <div className="border-border/70 hidden overflow-hidden rounded-xl border sm:block">
        <div className="border-border/70 bg-muted/20 flex items-center gap-3 border-b px-2 py-2">
          {[24, 96, 64, 64, 72, 160, 44].map((w, i) => (
            <Skeleton key={i} className="h-2.5 shrink-0 rounded-full" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-3 px-2 py-2.5',
              i > 0 && 'border-border/70 border-t'
            )}
            style={{ opacity: 1 - i * 0.08 }}
          >
            <Skeleton className="h-3 w-6 shrink-0" />
            <Skeleton className="h-3 w-24 shrink-0" />
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            <Skeleton className="h-3 max-w-[20rem] flex-1" />
            <Skeleton className="ml-auto size-8 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Frozen for as long as the fix sheet stays open: row status changes must not swap the queue. */
type FixSession = {
  rowId: string;
  mode: ImportRowFixMode;
  queue: string[];
};

export function ImportPreviewTable({ batchId, isLoading, error, onRetry }: Props) {
  const { rows, summary, isReady } = useImportBatchRows(batchId);
  const updateRow = useUpdateImportRow(batchId);
  const [page, setPage] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState<ImportPreviewStatusFilter>('error');
  const [fixSession, setFixSession] = React.useState<FixSession | null>(null);
  const [pendingAction, setPendingAction] = React.useState<'save' | 'skip' | 'restore' | null>(
    null
  );
  /** Host override — skip auto filter until the batch changes. */
  const filterTouchedRef = React.useRef(false);
  const filterBatchRef = React.useRef<string | null>(null);

  const setFilterFromUser = React.useCallback((next: ImportPreviewStatusFilter) => {
    filterTouchedRef.current = true;
    setStatusFilter(next);
  }, []);

  React.useEffect(() => {
    if (!isReady || !batchId) return;

    if (filterBatchRef.current !== batchId) {
      filterBatchRef.current = batchId;
      filterTouchedRef.current = false;
    }

    if (filterTouchedRef.current) {
      // Stay on Need fixing only while that queue still has work.
      if (statusFilter === 'error' && summary.error === 0) {
        setStatusFilter('valid');
      }
      return;
    }

    setStatusFilter(summary.error > 0 ? 'error' : 'valid');
  }, [batchId, isReady, statusFilter, summary.error]);

  const filteredRows = React.useMemo(() => filterRows(rows, statusFilter), [rows, statusFilter]);

  const errorRowIds = React.useMemo(
    () => rows.filter((row) => row.validationStatus === 'error').map((row) => row.id),
    [rows]
  );
  const skippedRowIds = React.useMemo(
    () => rows.filter((row) => row.validationStatus === 'skipped').map((row) => row.id),
    [rows]
  );

  const fixRow = fixSession ? (rows.find((row) => row.id === fixSession.rowId) ?? null) : null;
  const fixQueueIndex = fixSession ? fixSession.queue.indexOf(fixSession.rowId) : -1;

  /** Opening decides the queue once; later status changes must not move the host to another queue. */
  const openFixRow = React.useCallback(
    (rowId: string) => {
      const isSkipped = rows.find((row) => row.id === rowId)?.validationStatus === 'skipped';
      const queue = isSkipped ? skippedRowIds : errorRowIds;
      setFixSession({
        rowId,
        mode: isSkipped ? 'restore' : 'fix',
        queue: queue.includes(rowId) ? queue : [rowId],
      });
    },
    [errorRowIds, rows, skippedRowIds]
  );

  /** Drop a resolved row from the frozen queue and land on its neighbour, or close when the queue empties. */
  const advanceFixSession = React.useCallback((rowId: string) => {
    setFixSession((current) => {
      if (!current) return null;
      const index = current.queue.indexOf(rowId);
      const queue = index >= 0 ? current.queue.filter((id) => id !== rowId) : current.queue;
      if (queue.length === 0) return null;
      const nextRowId = index >= 0 ? (queue[index] ?? queue[queue.length - 1]) : current.rowId;
      return { ...current, rowId: nextRowId, queue };
    });
  }, []);

  const handleImportToggle = React.useCallback(
    (rowId: string, willImport: boolean) => {
      updateRow.mutate({
        batchId,
        rowId,
        validationStatus: willImport ? 'valid' : 'skipped',
      });
    },
    [batchId, updateRow]
  );

  const handleSaveFixes = React.useCallback(
    async (input: UpdateImportRowInput) => {
      setPendingAction('save');
      try {
        const result = await updateRow.mutateAsync(input);
        if (result.validationStatus === 'valid') {
          toast.success('Row is ready to import');
          advanceFixSession(input.rowId);
        }
      } finally {
        setPendingAction(null);
      }
    },
    [advanceFixSession, updateRow]
  );

  const handleSkipRow = React.useCallback(
    async (rowId: string) => {
      setPendingAction('skip');
      try {
        await updateRow.mutateAsync({
          batchId,
          rowId,
          validationStatus: 'skipped',
        });
        advanceFixSession(rowId);
      } finally {
        setPendingAction(null);
      }
    },
    [advanceFixSession, batchId, updateRow]
  );

  const handleRestoreRow = React.useCallback(
    async (rowId: string) => {
      setPendingAction('restore');
      try {
        const result = await updateRow.mutateAsync({
          batchId,
          rowId,
          validationStatus: 'valid',
        });
        if (result.validationStatus === 'valid') {
          toast.success('Row restored');
        } else {
          toast.warning('Row restored. It still needs fixing before import');
        }
        advanceFixSession(rowId);
      } finally {
        setPendingAction(null);
      }
    },
    [advanceFixSession, batchId, updateRow]
  );

  const updatingRowId = updateRow.isPending ? updateRow.variables?.rowId : undefined;

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);

  React.useEffect(() => {
    setPage(0);
  }, [batchId, filteredRows.length, statusFilter]);

  if (isLoading) {
    return <ImportPreviewTableSkeleton />;
  }

  if (error) {
    return (
      <ImportAlert
        tone="error"
        action={
          onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      >
        {error}
      </ImportAlert>
    );
  }

  if (!isReady) return null;

  return (
    <>
      <div className="space-y-3">
        <PreviewSummary
          summary={summary}
          filter={statusFilter}
          onFilterChange={setFilterFromUser}
        />
        <PreviewIssueGuidance errorCount={summary.error} />

        {filteredRows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No rows match this filter.
          </p>
        ) : (
          <>
            <ul className="space-y-2 sm:hidden">
              {pageRows.map((row) => (
                <PreviewRowMobile
                  key={row.id}
                  row={row}
                  displayIndex={row.rowIndex + 1}
                  isUpdating={updatingRowId === row.id}
                  onImportToggle={handleImportToggle}
                  onFix={openFixRow}
                />
              ))}
            </ul>

            <div className="border-border/70 hidden overflow-hidden rounded-xl border sm:block">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 w-10 px-2 text-xs">#</TableHead>
                    <TableHead className="h-9 w-[9rem] px-2 text-xs">Guest</TableHead>
                    <TableHead className="h-9 w-[7rem] px-2 text-xs">Check-in</TableHead>
                    <TableHead className="h-9 w-[7rem] px-2 text-xs">Check-out</TableHead>
                    <TableHead className="h-9 w-[7.5rem] px-2 text-xs">Status</TableHead>
                    <TableHead className="h-9 w-[25rem] px-2 text-xs">Issue</TableHead>
                    <TableHead className="h-9 w-[4.5rem] px-2 text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => (
                    <PreviewRowDesktop
                      key={row.id}
                      row={row}
                      displayIndex={row.rowIndex + 1}
                      isUpdating={updatingRowId === row.id}
                      onImportToggle={handleImportToggle}
                      onFix={openFixRow}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <PreviewPagination
              pageStart={pageStart}
              pageSize={PAGE_SIZE}
              total={filteredRows.length}
              safePage={safePage}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <ImportRowFixSheet
        batchId={batchId}
        open={Boolean(fixSession && fixRow)}
        onOpenChange={(open) => {
          if (!open) setFixSession(null);
        }}
        row={fixRow}
        mode={fixSession?.mode ?? 'fix'}
        queuePosition={
          fixSession && fixQueueIndex >= 0
            ? { index: fixQueueIndex, total: fixSession.queue.length }
            : null
        }
        isSaving={pendingAction === 'save' && updateRow.isPending}
        isSkipping={pendingAction === 'skip' && updateRow.isPending}
        isRestoring={pendingAction === 'restore' && updateRow.isPending}
        onSave={handleSaveFixes}
        onSkip={handleSkipRow}
        onRestore={handleRestoreRow}
        onPrevious={() => {
          if (fixQueueIndex > 0) {
            setFixSession((current) =>
              current ? { ...current, rowId: current.queue[fixQueueIndex - 1]! } : current
            );
          }
        }}
        onNext={() => {
          if (fixSession && fixQueueIndex >= 0 && fixQueueIndex < fixSession.queue.length - 1) {
            setFixSession((current) =>
              current ? { ...current, rowId: current.queue[fixQueueIndex + 1]! } : current
            );
          }
        }}
      />
    </>
  );
}
