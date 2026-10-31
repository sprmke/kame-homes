import * as React from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { BOOKINGS_QUERY_KEY } from '@/features/dashboard/bookings/hooks/useBookings';
import { ImportFileDropzone } from '@/features/dashboard/import/components/ImportFileDropzone';
import { ImportManualMappingRow } from '@/features/dashboard/import/components/ImportManualMappingRow';
import {
  ImportAlert,
  ImportFileBar,
  ImportModalBody,
  ImportModalFooter,
  ImportModalHeader,
  ImportStatStrip,
  ImportStepHeading,
  ImportStepper,
} from '@/features/dashboard/import/components/ImportModalChrome';
import { ImportPreviewTable } from '@/features/dashboard/import/components/ImportPreviewTable';
import { useAiMapColumns } from '@/features/dashboard/import/hooks/useAiMapColumns';
import { useCancelImportBatch } from '@/features/dashboard/import/hooks/useCancelImportBatch';
import {
  useCommitImportBatch,
  type CommitImportBatchFailure,
} from '@/features/dashboard/import/hooks/useCommitImportBatch';
import {
  clearImportPreviewCache,
  useImportBatchRows,
} from '@/features/dashboard/import/hooks/useImportBatchRows';
import { useImportPreview } from '@/features/dashboard/import/hooks/useImportPreview';
import { useSaveImportMapping } from '@/features/dashboard/import/hooks/useSaveImportMapping';
import { downloadImportCsvTemplate } from '@/features/dashboard/import/lib/importCsvTemplate';
import {
  labelForImportTarget,
  REQUIRED_TARGET_FIELDS,
} from '@/features/dashboard/import/lib/importTargetFields';
import type {
  AiMapColumnsResult,
  ImportBatchRowPreview,
  ImportColumnMappingEntry,
} from '@/features/dashboard/import/types/importBatch';
import type { ImportParseResult } from '@/features/dashboard/import/types/importParse';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ImportCommitStepSkeleton } from '@/components/skeletons/ImportWizardSkeleton';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

// ── Steps ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'automap' | 'preview' | 'commit';

const ALL_STEPS: Step[] = ['upload', 'automap', 'preview', 'commit'];

const STEP_LABELS: Record<Step, string> = {
  upload: 'Upload',
  automap: 'Match',
  preview: 'Preview',
  commit: 'Import',
};

const STEP_COPY: Record<Step, { title: string; description: string }> = {
  upload: {
    title: 'Add your file & let us do the work',
    description:
      'Upload a CSV or Excel spreadsheet of existing bookings. We’ll automatically recognize and attempt to match and map your columns to our template.',
  },
  automap: {
    title: 'Match your columns',
    description: 'Review automatic matches and resolve any columns that need your input.',
  },
  preview: {
    title: 'Check the rows',
    description:
      'Only rows marked Ready are imported. Open a row to fix invalid values, or turn off Import to skip a row.',
  },
  commit: {
    title: 'Review and import',
    description: 'Confirm what will be added before completing the import.',
  },
};

// ── Upload step ───────────────────────────────────────────────────────────────

type UploadStepProps = {
  parseResult: ImportParseResult | null;
  onParsed: (result: ImportParseResult) => void;
  onReplace: () => void;
  isBusy?: boolean;
};

function UploadStep({ parseResult, onParsed, onReplace, isBusy }: UploadStepProps) {
  return parseResult ? (
    <ImportFileBar
      fileName={parseResult.fileName}
      rowCount={parseResult.rowCount}
      columnCount={parseResult.headers.length}
      onReplace={onReplace}
      replaceDisabled={isBusy}
    />
  ) : (
    <ImportFileDropzone onParsed={onParsed} disabled={isBusy} />
  );
}

// ── Match step ────────────────────────────────────────────────────────────────

function ImportColumnMappingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Matching columns">
      <div className="divide-border/70 border-border/70 grid grid-cols-2 divide-x overflow-hidden rounded-xl border">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-muted/25 space-y-1.5 px-3 py-2.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-8" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-border/70 grid grid-cols-1 items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_1rem_minmax(0,15rem)]"
            style={{ opacity: 1 - i * 0.08 }}
          >
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-24 max-w-full" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
            <div className="hidden sm:block" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

type AutoMapStepProps = {
  aiResult: AiMapColumnsResult | null;
  parseResult: ImportParseResult;
  mappingState: Record<string, string | null>;
  onMappingChange: (header: string, target: string | null) => void;
  isLoading: boolean;
  error: string | null;
  saveError: string | null;
  missingRequired: string[];
  onRunMapping: () => void;
  onRetrySave: () => void;
};

function AutoMapStep({
  aiResult,
  parseResult,
  mappingState,
  onMappingChange,
  isLoading,
  error,
  saveError,
  missingRequired,
  onRunMapping,
  onRetrySave,
}: AutoMapStepProps) {
  const [activeTab, setActiveTab] = React.useState<'review' | 'matched'>('review');
  const mappings = aiResult?.columnMapping.mappings ?? [];
  const needsReview = mappings.filter((entry) => entry.status !== 'matched');
  const matched = mappings.filter((entry) => entry.status === 'matched');

  React.useEffect(() => {
    if (!aiResult && !isLoading && !error) {
      onRunMapping();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!aiResult) return;
    setActiveTab(needsReview.length > 0 ? 'review' : 'matched');
    // Reset only for a new mapping result, not while the host edits selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResult?.batchId]);

  React.useEffect(() => {
    if (missingRequired.length > 0 || saveError) setActiveTab('review');
  }, [missingRequired.length, saveError]);

  const usedTargets = new Set<string>();
  for (const [, target] of Object.entries(mappingState)) {
    if (target) usedTargets.add(target);
  }
  for (const entry of matched) {
    if (entry.suggestedTarget) usedTargets.add(entry.suggestedTarget);
  }

  const samplesByHeader: Record<string, string[]> = {};
  for (const header of parseResult.headers) {
    samplesByHeader[header] = parseResult.sampleRows
      .map((row) => String(row[header] ?? '').trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  if (isLoading) {
    return <ImportColumnMappingSkeleton />;
  }

  if (error) {
    return (
      <ImportAlert
        tone="error"
        action={
          <Button type="button" variant="outline" size="sm" onClick={onRunMapping}>
            Try again
          </Button>
        }
      >
        {error}
      </ImportAlert>
    );
  }

  if (!aiResult) return null;

  return (
    <div className="space-y-3">
      {aiResult.degraded ? (
        <ImportAlert tone="warning">
          Matching ran in basic mode, so please double-check the suggestions.
        </ImportAlert>
      ) : null}

      <ImportStatStrip
        ariaLabel="Show columns by match status"
        stats={[
          {
            label: 'Matched',
            value: matched.length,
            tone: 'primary',
            selected: activeTab === 'matched',
            onSelect: () => setActiveTab('matched'),
          },
          {
            label: 'Need input',
            value: needsReview.length,
            tone: 'warning',
            selected: activeTab === 'review',
            onSelect: () => setActiveTab('review'),
          },
        ]}
      />

      {activeTab === 'review' ? (
        <div className="space-y-2">
          {saveError ? (
            <ImportAlert
              tone="error"
              action={
                <Button type="button" variant="outline" size="sm" onClick={onRetrySave}>
                  Try again
                </Button>
              }
            >
              {saveError}
            </ImportAlert>
          ) : null}
          {missingRequired.length > 0 ? (
            <ImportAlert tone="warning">
              Still need: {missingRequired.map(labelForImportTarget).join(', ')}
            </ImportAlert>
          ) : null}

          {needsReview.length > 0 ? (
            needsReview.map((entry: ImportColumnMappingEntry) => (
              <ImportManualMappingRow
                key={entry.rawHeader}
                entry={entry}
                samples={samplesByHeader[entry.rawHeader] ?? []}
                value={mappingState[entry.rawHeader] ?? null}
                onChange={onMappingChange}
                usedTargets={usedTargets}
              />
            ))
          ) : (
            <div className="border-border/70 flex flex-col items-center gap-2 rounded-xl border py-10 text-center">
              <CheckCircle2 className="text-primary size-6" aria-hidden />
              <p className="text-foreground text-sm font-medium">No columns need input</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {matched.length > 0 ? (
            <ul className="border-border/70 divide-border/60 divide-y overflow-hidden rounded-xl border">
              {matched.map((entry) => (
                <li
                  key={entry.rawHeader}
                  className="grid min-h-11 grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground min-w-0 truncate">{entry.rawHeader}</span>
                  <ChevronRight className="text-muted-foreground/60 size-4" aria-hidden />
                  <span className="text-foreground min-w-0 truncate font-medium">
                    {labelForImportTarget(entry.suggestedTarget)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground border-border/70 rounded-xl border py-10 text-center text-sm">
              No automatic matches.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Preview step ──────────────────────────────────────────────────────────────

type PreviewStepProps = {
  batchId: string;
  previewRunKey: number;
  isLoading: boolean;
  error: string | null;
  onRunPreview: (force?: boolean) => void;
};

function PreviewStep({ batchId, previewRunKey, isLoading, error, onRunPreview }: PreviewStepProps) {
  React.useEffect(() => {
    onRunPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, previewRunKey]);

  return (
    <ImportPreviewTable
      batchId={batchId}
      isLoading={isLoading}
      error={error}
      onRetry={() => onRunPreview(true)}
    />
  );
}

// ── Import step ───────────────────────────────────────────────────────────────

type CommitStepProps = {
  rows: ImportBatchRowPreview[];
  validCount: number;
  excludedCount: number;
  isCommitting: boolean;
  error: string | null;
  failedRows: CommitImportBatchFailure[];
};

const COMMIT_PAGE_SIZE = 10;

function importGuestName(row: ImportBatchRowPreview): string {
  return row.mappedData.primary_guest_name ?? row.mappedData.guest_display_name ?? 'No name';
}

function importTotalGuests(row: ImportBatchRowPreview): number {
  const adults = Number(row.mappedData.number_of_adults ?? 0);
  const children = Number(row.mappedData.number_of_children ?? 0);
  return (Number.isFinite(adults) ? adults : 0) + (Number.isFinite(children) ? children : 0);
}

function CommitStep({
  rows,
  validCount,
  excludedCount,
  isCommitting,
  error,
  failedRows,
}: CommitStepProps) {
  const [page, setPage] = React.useState(0);
  const visibleFailures = failedRows.slice(0, 5);
  const importRows = React.useMemo(
    () => rows.filter((row) => row.validationStatus === 'valid'),
    [rows]
  );
  const pageCount = Math.max(1, Math.ceil(importRows.length / COMMIT_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * COMMIT_PAGE_SIZE;
  const pageRows = importRows.slice(pageStart, pageStart + COMMIT_PAGE_SIZE);

  React.useEffect(() => {
    setPage(0);
  }, [rows]);

  if (isCommitting) {
    return <ImportCommitStepSkeleton rowCount={Math.min(COMMIT_PAGE_SIZE, validCount || 5)} />;
  }

  return (
    <div className="space-y-4">
      <ImportStatStrip
        ariaLabel="Import summary"
        stats={[
          { label: 'Ready to import', value: validCount, tone: 'primary' },
          { label: 'Not included', value: excludedCount, tone: 'neutral' },
        ]}
      />

      {error ? <ImportAlert tone="error">{error}</ImportAlert> : null}

      {visibleFailures.length > 0 ? (
        <div className="border-destructive/30 bg-destructive/5 divide-destructive/20 text-destructive divide-y overflow-hidden rounded-xl border text-xs">
          {visibleFailures.map((row) => (
            <p key={row.rowIndex} className="px-3 py-2">
              <span className="font-medium">Row {row.rowIndex + 1}</span> · {row.reason}
            </p>
          ))}
          {failedRows.length > visibleFailures.length ? (
            <p className="text-muted-foreground px-3 py-2">
              and {failedRows.length - visibleFailures.length} more
            </p>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="bookings-to-import-heading" className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <h3 id="bookings-to-import-heading" className="text-sm font-semibold">
            Bookings to import
          </h3>
          <p className="text-muted-foreground text-xs tabular-nums">
            {importRows.length.toLocaleString()} total
          </p>
        </div>

        <ul className="divide-border/70 border-border/70 divide-y overflow-hidden rounded-xl border sm:hidden">
          {pageRows.map((row) => (
            <li key={row.id} className="space-y-2.5 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{importGuestName(row)}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    Row {row.rowIndex + 1}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(row.mappedData.booking_rate)}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Check-in</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">
                    {row.mappedData.check_in_date ?? '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Check-out</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">
                    {row.mappedData.check_out_date ?? '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Guests</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{importTotalGuests(row)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <div className="border-border/70 hidden overflow-hidden rounded-xl border sm:block">
          <Table className="table-fixed">
            <TableCaption className="sr-only">
              Bookings that will be created when the import is confirmed
            </TableCaption>
            <TableHeader className="bg-muted/35">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-12 px-3 text-xs">#</TableHead>
                <TableHead className="h-9 px-3 text-xs">Guest</TableHead>
                <TableHead className="h-9 w-32 px-3 text-xs">Check-in</TableHead>
                <TableHead className="h-9 w-32 px-3 text-xs">Check-out</TableHead>
                <TableHead className="h-9 w-24 px-3 text-right text-xs">Guests</TableHead>
                <TableHead className="h-9 w-36 px-3 text-right text-xs">Booking rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground px-3 py-2.5 text-xs tabular-nums">
                    {row.rowIndex + 1}
                  </TableCell>
                  <TableCell className="truncate px-3 py-2.5 text-sm font-medium">
                    {importGuestName(row)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-xs tabular-nums">
                    {row.mappedData.check_in_date ?? '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-xs tabular-nums">
                    {row.mappedData.check_out_date ?? '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right text-xs font-medium tabular-nums">
                    {importTotalGuests(row)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
                    {formatMoney(row.mappedData.booking_rate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-muted-foreground text-xs tabular-nums">
              {pageStart + 1}–{Math.min(pageStart + COMMIT_PAGE_SIZE, importRows.length)} of{' '}
              {importRows.length.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Previous bookings"
                disabled={safePage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Next bookings"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function coveredTargets(
  aiResult: AiMapColumnsResult | null,
  mappingState: Record<string, string | null>
): Set<string> {
  const used = new Set<string>();
  if (!aiResult) return used;
  for (const entry of aiResult.columnMapping.mappings) {
    if (entry.status === 'matched' && entry.suggestedTarget) {
      used.add(entry.suggestedTarget);
    }
  }
  for (const target of Object.values(mappingState)) {
    if (target) used.add(target);
  }
  return used;
}

function missingRequiredTargets(
  aiResult: AiMapColumnsResult | null,
  mappingState: Record<string, string | null>
): string[] {
  const used = coveredTargets(aiResult, mappingState);
  return REQUIRED_TARGET_FIELDS.map((f) => f.id).filter((id) => !used.has(id));
}

function buildFinalColumnMapping(
  aiResult: AiMapColumnsResult,
  mappingState: Record<string, string | null>
): Record<string, string | null> {
  const finalMapping: Record<string, string | null> = {};
  for (const entry of aiResult.columnMapping.mappings) {
    if (entry.status === 'matched' && entry.suggestedTarget) {
      finalMapping[entry.rawHeader] = entry.suggestedTarget;
    } else {
      finalMapping[entry.rawHeader] = mappingState[entry.rawHeader] ?? null;
    }
  }
  return finalMapping;
}

// ── Wizard ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportWizardModal({ open, onOpenChange }: Props) {
  const [step, setStep] = React.useState<Step>('upload');
  const [parseResult, setParseResult] = React.useState<ImportParseResult | null>(null);
  const [aiResult, setAiResult] = React.useState<AiMapColumnsResult | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [mappingState, setMappingState] = React.useState<Record<string, string | null>>({});
  const [isBatchCommitted, setIsBatchCommitted] = React.useState(false);
  const [commitResultError, setCommitResultError] = React.useState<string | null>(null);
  const [commitFailures, setCommitFailures] = React.useState<CommitImportBatchFailure[]>([]);
  const [previewRunKey, setPreviewRunKey] = React.useState(0);
  const [templateConfirmOpen, setTemplateConfirmOpen] = React.useState(false);
  const [showMissingRequired, setShowMissingRequired] = React.useState(false);

  /** Batch that must be cancelled if the modal closes without a successful commit. */
  const pendingCancelBatchIdRef = React.useRef<string | null>(null);
  const stepHeadingRef = React.useRef<HTMLHeadingElement>(null);

  const queryClient = useQueryClient();
  const propertyId = usePropertyIdParam();
  const { canUse: canImportBookings, isLoading: importEntitlementsLoading } =
    useFeatureGate('bookingImport');
  const { open: openUpgradeModal } = useUpgradeModal();
  const aiMapMutation = useAiMapColumns();
  const saveMappingMutation = useSaveImportMapping();
  const previewMutation = useImportPreview();
  const cancelMutation = useCancelImportBatch();
  const commitMutation = useCommitImportBatch();
  const {
    rows: previewRows,
    summary: previewSummary,
    isReady: previewReady,
  } = useImportBatchRows(parseResult?.batchId ?? null);

  // Reset wizard state only when the modal opens — not when mutation hooks re-render.
  React.useEffect(() => {
    if (!open) return;
    setStep('upload');
    setParseResult(null);
    setAiResult(null);
    setAiError(null);
    setMappingState({});
    setIsBatchCommitted(false);
    setCommitResultError(null);
    setCommitFailures([]);
    setPreviewRunKey(0);
    setTemplateConfirmOpen(false);
    setShowMissingRequired(false);
    previewMutation.reset();
    commitMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewMutation/commitMutation identities change every reset()
  }, [open]);

  // Cancel orphaned batches when the modal closes without a successful commit.
  React.useEffect(() => {
    if (open) return;
    const batchId = pendingCancelBatchIdRef.current;
    if (!batchId) return;
    pendingCancelBatchIdRef.current = null;
    void cancelMutation.mutateAsync(batchId).catch(() => {
      // Best effort cleanup.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [step, open]);

  const invalidatePreviewCache = React.useCallback(
    (batchId: string) => {
      clearImportPreviewCache(queryClient, propertyId ?? undefined, batchId);
      previewMutation.reset();
      setPreviewRunKey((key) => key + 1);
    },
    [queryClient, propertyId, previewMutation]
  );

  const handleParsed = (result: ImportParseResult) => {
    pendingCancelBatchIdRef.current = result.batchId;
    setParseResult(result);
    setAiResult(null);
    setAiError(null);
    setMappingState({});
    setShowMissingRequired(false);
  };

  const handleRunAiMapping = async () => {
    if (!parseResult) return;
    setAiError(null);
    try {
      const result = await aiMapMutation.mutateAsync(parseResult.batchId);
      setAiResult(result);

      const initial: Record<string, string | null> = {};
      for (const entry of result.columnMapping.mappings) {
        if (entry.status === 'likely_matched') {
          initial[entry.rawHeader] = entry.suggestedTarget;
        } else if (entry.status !== 'matched') {
          initial[entry.rawHeader] = null;
        }
      }
      setMappingState(initial);
    } catch (err) {
      setAiError((err as Error).message);
    }
  };

  const handleMappingChange = (header: string, target: string | null) => {
    setShowMissingRequired(false);
    setMappingState((prev) => ({ ...prev, [header]: target }));
  };

  /** Drop the staged batch when the user discards (route change or modal close). */
  const cancelPendingBatch = () => {
    const batchId = pendingCancelBatchIdRef.current ?? parseResult?.batchId ?? null;
    pendingCancelBatchIdRef.current = null;
    if (!batchId) return;
    void cancelMutation.mutateAsync(batchId).catch(() => {
      // Best effort cleanup.
    });
  };

  const isBusy =
    aiMapMutation.isPending ||
    saveMappingMutation.isPending ||
    previewMutation.isPending ||
    cancelMutation.isPending ||
    commitMutation.isPending;

  const handleReplaceFile = async () => {
    if (isBusy) return;
    const batchId = parseResult?.batchId ?? pendingCancelBatchIdRef.current;
    pendingCancelBatchIdRef.current = null;
    setParseResult(null);
    setAiResult(null);
    setAiError(null);
    setMappingState({});
    setShowMissingRequired(false);
    if (batchId) {
      try {
        await cancelMutation.mutateAsync(batchId);
      } catch {
        // Best effort — user can upload a new file anyway.
      }
    }
  };

  const { requestClose: guardedRequestClose, dialogProps: leaveDialogProps } = useGuardedClose({
    open,
    onOpenChange,
    isDirty: parseResult !== null && !isBatchCommitted,
    onDiscard: cancelPendingBatch,
  });

  const requestClose = () => {
    if (isBusy) return;
    guardedRequestClose();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    requestClose();
  };

  /**
   * Radix reports touch outside-pointerdowns on the following `click`, by which point React has
   * already flushed the confirm dialog closed — without this the wizard would treat "Keep working"
   * as an outside click and reopen the confirm.
   */
  const isFromConfirmDialog = (event: { detail?: { originalEvent?: Event } }) => {
    const target = event.detail?.originalEvent?.target;
    return target instanceof Element && Boolean(target.closest('[role="alertdialog"]'));
  };

  const visibleSteps = ALL_STEPS;

  const missingRequired = React.useMemo(
    () => missingRequiredTargets(aiResult, mappingState),
    [aiResult, mappingState]
  );

  const handleContinueFromAutomap = async () => {
    if (!aiResult || !parseResult) return;

    if (missingRequired.length > 0) {
      setShowMissingRequired(true);
      return;
    }

    try {
      await saveMappingMutation.mutateAsync({
        batchId: parseResult.batchId,
        columnMapping: buildFinalColumnMapping(aiResult, mappingState),
      });
      invalidatePreviewCache(parseResult.batchId);
      setStep('preview');
    } catch (err) {
      console.error('[ImportWizardModal] save mapping failed:', err);
    }
  };

  const handleRunPreview = async (force = false) => {
    if (!parseResult?.batchId || previewMutation.isPending) return;
    if (!force && previewReady) return;
    try {
      await previewMutation.mutateAsync(parseResult.batchId);
    } catch (err) {
      console.error('[ImportWizardModal] preview failed:', err);
    }
  };

  const handleCommit = async () => {
    if (!parseResult?.batchId || commitMutation.isPending) return;
    setCommitResultError(null);
    setCommitFailures([]);
    try {
      const data = await commitMutation.mutateAsync(parseResult.batchId);

      if (data.status === 'committed') {
        const importedCount = data.inserted ?? previewSummary.valid;
        pendingCancelBatchIdRef.current = null;
        setIsBatchCommitted(true);
        await Promise.all([queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY })]);
        toast.success(
          `Imported ${importedCount.toLocaleString()} booking${importedCount !== 1 ? 's' : ''}`
        );
        onOpenChange(false);
        return;
      }

      if (data.status === 'failed') {
        setCommitResultError(
          data.failed.length > 0
            ? `${data.failed.length} row${data.failed.length !== 1 ? 's' : ''} could not be added.`
            : 'Nothing was added. Please try again.'
        );
        setCommitFailures(data.failed);
        return;
      }

      setCommitResultError('There are no rows left to import.');
    } catch (err) {
      console.error('[ImportWizardModal] commit failed:', err);
    }
  };

  const commitError = commitMutation.isError
    ? (commitMutation.error as Error).message
    : commitResultError;

  const backTarget: Step | null =
    step === 'automap'
      ? 'upload'
      : step === 'preview'
        ? 'automap'
        : step === 'commit'
          ? 'preview'
          : null;

  const copy = STEP_COPY[step];
  const stepIdx = Math.max(0, visibleSteps.indexOf(step));
  /** Review-heavy steps need a tall scrollport; upload can shrink to content. */
  const tallStep = step === 'preview' || step === 'automap' || step === 'commit';

  const primaryAction = (() => {
    if (step === 'upload') {
      return (
        <TierBadgeAnchor feature="bookingImport" className="w-full sm:w-auto">
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isBusy || !parseResult}
            onClick={() => {
              if (!canImportBookings) {
                if (!importEntitlementsLoading) openUpgradeModal('bookingImport');
                return;
              }
              setStep('automap');
            }}
          >
            Continue
          </Button>
        </TierBadgeAnchor>
      );
    }

    if (step === 'automap') {
      return (
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={isBusy || !aiResult}
          onClick={() => void handleContinueFromAutomap()}
        >
          {saveMappingMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving
            </>
          ) : (
            'Continue'
          )}
        </Button>
      );
    }

    if (step === 'preview') {
      return (
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={isBusy || !previewReady || previewSummary.valid === 0}
          onClick={() => setStep('commit')}
        >
          Continue
        </Button>
      );
    }

    if (step === 'commit') {
      return (
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={isBusy || previewSummary.valid === 0}
          onClick={() => void handleCommit()}
        >
          {commitMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Importing
            </>
          ) : (
            `Import ${previewSummary.valid.toLocaleString()} booking${previewSummary.valid !== 1 ? 's' : ''}`
          )}
        </Button>
      );
    }

    return null;
  })();

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent
          className={cn(
            'flex w-[min(calc(100vw-1.5rem),68rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
            tallStep ? 'h-[min(90dvh,40rem)] max-h-[min(90dvh,40rem)]' : 'max-h-[min(90dvh,40rem)]',
            'sm:w-[min(94vw,68rem)] sm:max-w-[68rem] sm:p-0',
            tallStep && 'sm:h-[min(90dvh,40rem)] sm:max-h-[min(90dvh,40rem)]'
          )}
          sheetLayout="split"
          showCloseButton={false}
          aria-label="AI-Assisted import bookings"
          onEscapeKeyDown={(event) => {
            if (isBusy || leaveDialogProps.open) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            requestClose();
          }}
          onPointerDownOutside={(event) => {
            if (isBusy || leaveDialogProps.open || isFromConfirmDialog(event)) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            requestClose();
          }}
          onInteractOutside={(event) => {
            if (isBusy || leaveDialogProps.open || isFromConfirmDialog(event)) {
              event.preventDefault();
            }
          }}
        >
          <ImportModalHeader
            icon={<Upload className="size-4" aria-hidden />}
            title="AI-Assisted import bookings"
            closeDisabled={isBusy}
            onClose={requestClose}
            below={
              <ImportStepper
                labels={visibleSteps.map((s) => STEP_LABELS[s])}
                currentIndex={stepIdx}
              />
            }
          />

          <ImportModalBody fill={tallStep}>
            <ResponsiveModalDescription className="sr-only">
              {`Step ${stepIdx + 1} of ${visibleSteps.length}. ${copy.description}`}
            </ResponsiveModalDescription>
            <p className="sr-only" aria-live="polite">
              {copy.title}. {copy.description}
            </p>

            <ImportStepHeading
              title={copy.title}
              description={copy.description}
              headingRef={stepHeadingRef}
              className={parseResult && step !== 'upload' ? 'mb-3' : 'mb-4'}
            />

            {parseResult && step !== 'upload' ? (
              <div className="mb-4">
                <ImportFileBar
                  fileName={parseResult.fileName}
                  rowCount={parseResult.rowCount}
                  columnCount={parseResult.headers.length}
                />
              </div>
            ) : null}

            {step === 'upload' && (
              <UploadStep
                parseResult={parseResult}
                onParsed={handleParsed}
                onReplace={() => void handleReplaceFile()}
                isBusy={isBusy}
              />
            )}

            {step === 'automap' && parseResult && (
              <AutoMapStep
                aiResult={aiResult}
                parseResult={parseResult}
                mappingState={mappingState}
                onMappingChange={handleMappingChange}
                isLoading={aiMapMutation.isPending}
                error={aiError}
                saveError={
                  saveMappingMutation.isError ? (saveMappingMutation.error as Error).message : null
                }
                missingRequired={showMissingRequired ? missingRequired : []}
                onRunMapping={() => void handleRunAiMapping()}
                onRetrySave={() => void handleContinueFromAutomap()}
              />
            )}

            {step === 'preview' && parseResult && (
              <PreviewStep
                batchId={parseResult.batchId}
                previewRunKey={previewRunKey}
                isLoading={previewMutation.isPending}
                error={previewMutation.isError ? (previewMutation.error as Error).message : null}
                onRunPreview={(force) => void handleRunPreview(force)}
              />
            )}

            {step === 'commit' && (
              <CommitStep
                rows={previewRows}
                validCount={previewSummary.valid}
                excludedCount={previewSummary.error + previewSummary.skipped}
                isCommitting={commitMutation.isPending}
                error={commitError}
                failedRows={commitFailures}
              />
            )}
          </ImportModalBody>

          <ImportModalFooter
            left={
              backTarget ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  disabled={isBusy}
                  onClick={() => setStep(backTarget)}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Back
                </Button>
              ) : step === 'upload' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground min-h-11 w-full sm:w-auto"
                  onClick={() => setTemplateConfirmOpen(true)}
                >
                  <Download className="size-4" aria-hidden />
                  Download template
                </Button>
              ) : null
            }
            right={primaryAction}
          />
        </ResponsiveModalContent>
      </ResponsiveModal>

      <AlertDialog open={templateConfirmOpen} onOpenChange={setTemplateConfirmOpen}>
        <AlertDialogContent
          overlayClassName="z-[110] pointer-events-auto"
          className="pointer-events-auto z-[111] max-w-[min(calc(100vw-1.5rem),35rem)]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>No manual updates needed!</AlertDialogTitle>
            <AlertDialogDescription>
              Upload your existing CSV or spreadsheet as-is. We automatically recognizes and
              attempts to match and map your columns to our template. No need for any manual
              updates! Our template is available for reference only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" onClick={() => setTemplateConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              onClick={() => {
                setTemplateConfirmOpen(false);
                downloadImportCsvTemplate();
              }}
            >
              <Download className="size-4" aria-hidden />
              Download template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesDialog {...leaveDialogProps} />
    </>
  );
}
