import * as React from 'react';

import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, RotateCcw, Wrench } from 'lucide-react';

import {
  ImportModalBody,
  ImportModalFooter,
  ImportModalHeader,
} from '@/features/dashboard/import/components/ImportModalChrome';
import type { UpdateImportRowInput } from '@/features/dashboard/import/hooks/useUpdateImportRow';
import { validateImportFieldDraft } from '@/features/dashboard/import/lib/importRowDraftValidation';
import {
  BOOKING_IMPORT_TARGET_FIELDS,
  labelForImportTarget,
} from '@/features/dashboard/import/lib/importTargetFields';
import type { ImportBatchRowPreview } from '@/features/dashboard/import/types/importBatch';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveModal, ResponsiveModalContent } from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

/** Queue the sheet was opened from — fixed for the whole session so actions never swap the footer. */
export type ImportRowFixMode = 'fix' | 'restore';

type Props = {
  batchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ImportBatchRowPreview | null;
  mode: ImportRowFixMode;
  queuePosition: { index: number; total: number } | null;
  isSaving: boolean;
  isSkipping: boolean;
  isRestoring: boolean;
  onSave: (input: UpdateImportRowInput) => Promise<void>;
  onSkip: (rowId: string) => Promise<void>;
  onRestore: (rowId: string) => Promise<void>;
  onPrevious: () => void;
  onNext: () => void;
};

function guestName(row: ImportBatchRowPreview): string {
  return row.mappedData.primary_guest_name ?? row.mappedData.guest_display_name ?? 'No name';
}

function blockingErrors(row: ImportBatchRowPreview) {
  return row.validationErrors.filter((entry) => entry.severity === 'error');
}

function inputTypeForField(fieldId: string): React.HTMLInputTypeAttribute {
  const field = BOOKING_IMPORT_TARGET_FIELDS.find((entry) => entry.id === fieldId);
  switch (field?.type) {
    case 'email':
      return 'email';
    case 'phone':
      return 'tel';
    default:
      return 'text';
  }
}

function placeholderForField(fieldId: string): string | undefined {
  const field = BOOKING_IMPORT_TARGET_FIELDS.find((entry) => entry.id === fieldId);
  if (field?.type === 'date') return 'YYYY-MM-DD or MM-DD-YYYY';
  if (field?.type === 'boolean') return 'yes or no';
  return undefined;
}

function initialFieldDrafts(row: ImportBatchRowPreview): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const error of blockingErrors(row)) {
    if (!error.field) continue;
    drafts[error.field] =
      (error.value && String(error.value).trim()) ||
      String(row.mappedData[error.field] ?? '').trim();
  }
  return drafts;
}

function rowDetailEntries(row: ImportBatchRowPreview, errors: ReturnType<typeof blockingErrors>) {
  const errorByField = new Map(
    errors.flatMap((error) => (error.field ? [[error.field, error] as const] : []))
  );

  return BOOKING_IMPORT_TARGET_FIELDS.flatMap((field) => {
    const fieldError = errorByField.get(field.id);
    const rawValue = String(fieldError?.value ?? row.mappedData[field.id] ?? '').trim();
    const value = fieldError ? rawValue || '-' : rawValue;
    return value
      ? [
          {
            fieldId: field.id,
            label: field.description,
            value,
            needsFix: Boolean(fieldError),
          },
        ]
      : [];
  });
}

export function ImportRowFixSheet({
  batchId,
  open,
  onOpenChange,
  row,
  mode,
  queuePosition,
  isSaving,
  isSkipping,
  isRestoring,
  onSave,
  onSkip,
  onRestore,
  onPrevious,
  onNext,
}: Props) {
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (row) setDrafts(initialFieldDrafts(row));
  }, [row]);

  const errors = React.useMemo(() => (row ? blockingErrors(row) : []), [row]);
  const isRestoreMode = mode === 'restore';
  const busy = isSaving || isSkipping || isRestoring;
  const canNavigate = Boolean(queuePosition && queuePosition.total > 1);
  const validationByField = React.useMemo(() => {
    if (!row) return {};
    return Object.fromEntries(
      errors.flatMap((error) =>
        error.field
          ? [
              [
                error.field,
                validateImportFieldDraft({
                  fieldId: error.field,
                  value: drafts[error.field] ?? '',
                  mappedData: row.mappedData,
                  drafts,
                }),
              ],
            ]
          : []
      )
    ) as Record<string, string | null>;
  }, [drafts, errors, row]);
  const hasChanges = row
    ? Object.entries(initialFieldDrafts(row)).some(
        ([fieldId, initialValue]) => (drafts[fieldId] ?? '') !== initialValue
      )
    : false;
  const canFix =
    Boolean(row) &&
    errors.length > 0 &&
    hasChanges &&
    Object.values(validationByField).every((message) => message === null);
  const details = row ? rowDetailEntries(row, errors) : [];

  const handleSave = async () => {
    if (!row || errors.length === 0) return;

    const fieldValues: Record<string, string> = {};
    for (const error of errors) {
      if (!error.field) continue;
      fieldValues[error.field] = drafts[error.field] ?? '';
    }

    await onSave({
      batchId,
      rowId: row.id,
      fieldValues,
    });
  };

  const saveDraft = async (): Promise<boolean> => {
    if (!canFix || busy) return false;
    try {
      await handleSave();
      return true;
    } catch {
      return false;
    }
  };

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty: hasChanges,
    onSave: saveDraft,
  });

  const [pendingMove, setPendingMove] = React.useState<(() => void) | null>(null);
  const [moveSaving, setMoveSaving] = React.useState(false);
  const guardMove = (move: () => void) => {
    if (hasChanges) setPendingMove(() => move);
    else move();
  };

  const handleSkip = async () => {
    if (!row) return;
    await onSkip(row.id);
  };

  const handleRestore = async () => {
    if (!row) return;
    await onRestore(row.id);
  };

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          showCloseButton={false}
          className="flex h-[min(90dvh,46rem)] max-h-[min(90dvh,46rem)] w-[min(calc(100vw-1.5rem),68rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[min(94vw,68rem)] sm:max-w-[68rem] sm:p-0"
          aria-label={isRestoreMode ? 'Review skipped import row' : 'Fix import row'}
        >
          <ImportModalHeader
            icon={
              isRestoreMode ? (
                <RotateCcw className="size-4" aria-hidden />
              ) : (
                <Wrench className="size-4" aria-hidden />
              )
            }
            title={
              isRestoreMode
                ? row
                  ? `Skipped row ${row.rowIndex + 1}`
                  : 'Skipped row'
                : row
                  ? `Fix row ${row.rowIndex + 1}`
                  : 'Fix row'
            }
            closeDisabled={busy}
            onClose={requestClose}
            below={
              row ? (
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">{guestName(row)}</span>
                  {queuePosition
                    ? ` · ${queuePosition.index + 1} of ${queuePosition.total} ${
                        isRestoreMode ? 'skipped' : 'needing fixes'
                      }`
                    : null}
                </p>
              ) : null
            }
          />

          <ImportModalBody fill>
            {!row ? null : errors.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No blocking issues on this row.
              </p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
                <section aria-labelledby="row-details" className="min-w-0">
                  <h3 id="row-details" className="text-sm font-semibold">
                    Row details
                  </h3>
                  {details.length > 0 ? (
                    <dl className="divide-border/70 mt-2 divide-y rounded-xl border">
                      {details.map((detail) => (
                        <div
                          key={detail.fieldId}
                          className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-3 px-3 py-2.5 text-xs"
                        >
                          <dt
                            className={cn(
                              'text-muted-foreground',
                              detail.needsFix && 'text-destructive'
                            )}
                          >
                            {detail.needsFix ? (
                              <span className="sr-only">Needs fixing: </span>
                            ) : null}
                            {detail.label}
                          </dt>
                          <dd
                            className={cn(
                              'text-foreground min-w-0 break-words font-medium',
                              detail.needsFix && 'text-destructive'
                            )}
                          >
                            {detail.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-muted-foreground mt-2 text-xs">
                      No other values were mapped for this row.
                    </p>
                  )}
                </section>

                <section aria-labelledby="fields-to-fix" className="min-w-0 space-y-3">
                  <div>
                    <h3 id="fields-to-fix" className="text-sm font-semibold">
                      Fields to fix
                    </h3>
                    {errors.length > 1 ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Correct all {errors.length} fields to enable Fix.
                      </p>
                    ) : null}
                  </div>

                  {errors.map((error) => {
                    if (!error.field) return null;
                    const fieldId = error.field;
                    const validationMessage = validationByField[fieldId];
                    const isValid = validationMessage === null;
                    const messageId = `fix-${fieldId}-message`;

                    return (
                      <div
                        key={fieldId}
                        className="border-border/70 bg-muted/20 space-y-2 rounded-xl border p-3"
                      >
                        <Label htmlFor={`fix-${fieldId}`} className="text-sm font-medium">
                          {labelForImportTarget(fieldId)}
                        </Label>
                        <Input
                          id={`fix-${fieldId}`}
                          type={inputTypeForField(fieldId)}
                          inputMode={fieldId.includes('phone') ? 'tel' : undefined}
                          placeholder={placeholderForField(fieldId)}
                          className={cn(
                            'min-h-11',
                            !isValid && 'border-destructive focus-visible:ring-destructive'
                          )}
                          value={drafts[fieldId] ?? ''}
                          disabled={busy}
                          aria-invalid={!isValid}
                          aria-describedby={messageId}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [fieldId]: event.target.value }))
                          }
                        />
                        <p
                          id={messageId}
                          className={cn(
                            'flex items-center gap-1.5 text-xs',
                            isValid ? 'text-primary' : 'text-destructive'
                          )}
                          role={isValid ? 'status' : 'alert'}
                        >
                          {isValid ? (
                            <>
                              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                              Valid
                            </>
                          ) : (
                            validationMessage
                          )}
                        </p>
                      </div>
                    );
                  })}
                </section>
              </div>
            )}
          </ImportModalBody>

          <ImportModalFooter
            left={
              canNavigate ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={busy || queuePosition!.index <= 0}
                    onClick={() => guardMove(onPrevious)}
                  >
                    <ChevronLeft className="mr-1 size-4" aria-hidden />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={busy || queuePosition!.index >= queuePosition!.total - 1}
                    onClick={() => guardMove(onNext)}
                  >
                    Next
                    <ChevronRight className="ml-1 size-4" aria-hidden />
                  </Button>
                </div>
              ) : null
            }
            right={
              <div className="flex items-center gap-2">
                {isRestoreMode ? (
                  <Button
                    type="button"
                    variant={errors.length === 0 ? 'default' : 'outline-primary'}
                    size="sm"
                    className="min-h-11 min-w-24"
                    disabled={busy || !row}
                    onClick={() => void handleRestore()}
                  >
                    {isRestoring ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                        Restoring…
                      </>
                    ) : (
                      'Restore'
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline-primary"
                    size="sm"
                    className="min-h-11 min-w-24"
                    disabled={busy || !row}
                    onClick={() => void handleSkip()}
                  >
                    {isSkipping ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                        Skipping…
                      </>
                    ) : (
                      'Skip'
                    )}
                  </Button>
                )}
                {isRestoreMode && errors.length === 0 ? null : (
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11 min-w-24"
                    disabled={busy || !canFix}
                    onClick={() => void handleSave()}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                        Fixing…
                      </>
                    ) : (
                      'Fix'
                    )}
                  </Button>
                )}
              </div>
            }
          />
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
      <UnsavedChangesDialog
        open={pendingMove !== null}
        action="leave"
        isSaving={moveSaving}
        onKeepEditing={() => setPendingMove(null)}
        onDiscard={() => {
          const move = pendingMove;
          setPendingMove(null);
          move?.();
        }}
        onSave={async () => {
          const move = pendingMove;
          setMoveSaving(true);
          try {
            const saved = await saveDraft();
            setPendingMove(null);
            if (saved) move?.();
          } finally {
            setMoveSaving(false);
          }
        }}
      />
    </>
  );
}
