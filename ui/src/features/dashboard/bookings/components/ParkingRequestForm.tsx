/**
 * ParkingRequestForm — Sub-form shown in WorkflowPanel when transitioning
 * from PENDING_PARKING_REQUEST → PENDING_PET_REQUEST | READY_FOR_CHECKIN.
 *
 * Captures: parking_owner (owner/agent name), parking_rate_paid (Owner Parking Rate),
 * parking_endorsement_url, and whether the guest parking fee was included in the
 * downpayment receipt or paid separately (with receipt upload).
 * Displays read-only `parking_rate_guest` (Parking Rate).
 *
 * Plan: docs/planning/NEW_FLOW_PLAN.md §6.1 Q4.4, Q4.5
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { BookingCompactAssetControl } from '@/features/dashboard/bookings/components/BookingCompactAssetControl';
import {
  ReceiptAiVerdictBadge,
  receiptAiUploadToastMessage,
  showDocumentAiModelErrorToast,
  receiptAiVerdictBlocksAdmin,
  type ReceiptAiVerdict,
} from '@/features/dashboard/bookings/components/ReceiptAiVerdictBadge';
import {
  focusFirstWorkflowFieldError,
  useRegisterWorkflowProceedValidator,
} from '@/features/dashboard/bookings/components/workflow-panel/WorkflowProceedValidationContext';
import {
  WorkflowFormShell,
  workflowFormEditTitle,
  type WorkflowFormVariant,
} from '@/features/dashboard/bookings/components/WorkflowFormShell';
import type { BookingAssetPreviewHandler } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import { useClearBookingAsset } from '@/features/dashboard/bookings/hooks/useClearBookingAsset';
import { useUploadBookingAsset } from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';
import { requiredPositiveMoney } from '@/features/dashboard/bookings/lib/moneyFieldSchema';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { isPostPendingDocumentsStatus } from '@/features/dashboard/bookings/lib/workflow';

import { Checkbox } from '@/components/ui/checkbox';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { formatMoney } from '@/utils/format/currency';

const parkingRequestFormSchema = z
  .object({
    parking_owner: z.string().trim().min(1, 'Enter parking owner or agent name'),
    parking_rate_paid: requiredPositiveMoney({
      requiredError: 'Enter owner parking rate',
      positiveError: 'Enter a rate greater than 0',
    }),
    parking_endorsement_url: z.string().url('Please upload a parking endorsement image'),
    parking_fee_included_in_downpayment: z.boolean(),
    parking_payment_receipt_url: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.parking_fee_included_in_downpayment) return;
    const url = data.parking_payment_receipt_url.trim();
    if (!url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parking_payment_receipt_url'],
        message: 'Upload a parking payment receipt',
      });
      return;
    }
    try {
      z.string().url().parse(url);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parking_payment_receipt_url'],
        message: 'Upload a valid parking payment receipt',
      });
    }
  });

export type ParkingRequestValues = z.infer<typeof parkingRequestFormSchema>;

/** Default / restore “included in downpayment” from status and saved parking cycle. */
function resolveParkingFeeIncludedDefault(
  booking: Pick<
    BookingRow,
    | 'status'
    | 'parking_completed_at'
    | 'parking_fee_included_in_downpayment'
    | 'parking_payment_receipt_url'
  >,
  initialDraft?: Pick<
    ParkingRequestValues,
    'parking_fee_included_in_downpayment' | 'parking_payment_receipt_url'
  > | null
): boolean {
  if (initialDraft?.parking_fee_included_in_downpayment !== undefined) {
    return initialDraft.parking_fee_included_in_downpayment;
  }
  const receiptUrl =
    initialDraft?.parking_payment_receipt_url?.trim() ||
    booking.parking_payment_receipt_url?.trim() ||
    '';
  if (receiptUrl) {
    return false;
  }
  if (booking.parking_completed_at) {
    return booking.parking_fee_included_in_downpayment !== false;
  }
  return !isPostPendingDocumentsStatus(String(booking.status ?? ''));
}

/** Use for CTAs (e.g. Mark as Complete) so they stay in sync with form validation. */
export function isParkingRequestDraftComplete(values: ParkingRequestValues | null): boolean {
  if (values == null) return false;
  return parkingRequestFormSchema.safeParse(values).success;
}

type Props = {
  booking: BookingRow;
  initialDraft?: ParkingRequestValues | null;
  onChange: (values: ParkingRequestValues | null) => void;
  readOnly?: boolean;
  editMode?: boolean;
  variant?: WorkflowFormVariant;
  onPreview: BookingAssetPreviewHandler;
};

export function ParkingRequestForm({
  booking,
  initialDraft = null,
  onChange,
  readOnly = false,
  editMode = false,
  variant = 'workflow',
  onPreview,
}: Props) {
  const uploadMut = useUploadBookingAsset();
  const clearAssetMut = useClearBookingAsset();
  const [uploadingField, setUploadingField] = useState<'endorsement' | 'receipt' | null>(null);
  const stashedReceiptRef = useRef<{
    url: string;
    previewBust: number;
    verdict: ReceiptAiVerdict;
    summary: string;
  } | null>(null);
  const endorsementUploading = uploadingField === 'endorsement';
  const receiptUploading = uploadingField === 'receipt';
  const [currentEndorsementUrl, setCurrentEndorsementUrl] = useState(() => {
    if (initialDraft?.parking_endorsement_url) return initialDraft.parking_endorsement_url;
    return booking.parking_endorsement_url ?? '';
  });
  const [currentReceiptUrl, setCurrentReceiptUrl] = useState(() => {
    if (initialDraft?.parking_payment_receipt_url) return initialDraft.parking_payment_receipt_url;
    return booking.parking_payment_receipt_url ?? '';
  });
  /** Only the check from this visit's upload — not a stored verdict from an earlier step. */
  const [receiptAiVerdict, setReceiptAiVerdict] = useState<ReceiptAiVerdict>(null);
  const [receiptAiSummary, setReceiptAiSummary] = useState('');
  const blockingVerdict = receiptAiVerdict ?? booking.parking_receipt_ai_verdict ?? null;
  const [endorsementPreviewBust, setEndorsementPreviewBust] = useState(0);
  const [receiptPreviewBust, setReceiptPreviewBust] = useState(0);

  const {
    register,
    watch,
    formState: { errors, isValid },
    getValues,
    setValue,
    trigger,
  } = useForm<ParkingRequestValues>({
    resolver: zodResolver(parkingRequestFormSchema),
    defaultValues: {
      parking_owner:
        initialDraft?.parking_owner?.trim() ?? String(booking.parking_owner ?? '').trim(),
      parking_rate_paid:
        initialDraft?.parking_rate_paid ?? ((booking.parking_rate_paid as number) || undefined),
      parking_endorsement_url:
        initialDraft?.parking_endorsement_url ?? booking.parking_endorsement_url ?? '',
      parking_fee_included_in_downpayment: resolveParkingFeeIncludedDefault(booking, initialDraft),
      parking_payment_receipt_url:
        initialDraft?.parking_payment_receipt_url ?? booking.parking_payment_receipt_url ?? '',
    },
    mode: 'onChange',
  });

  const watched = watch();
  const includedInDownpayment = watch('parking_fee_included_in_downpayment');
  const [revealErrors, setRevealErrors] = useState(false);
  const shownErrors = revealErrors ? errors : {};

  const validateForProceed = useCallback(async () => {
    if (readOnly) return true;
    const ok = await trigger();
    setRevealErrors(true);
    if (!ok) {
      focusFirstWorkflowFieldError();
      return false;
    }
    const values = getValues();
    if (
      !editMode &&
      !values.parking_fee_included_in_downpayment &&
      values.parking_payment_receipt_url.trim() &&
      receiptAiVerdictBlocksAdmin(blockingVerdict)
    ) {
      focusFirstWorkflowFieldError();
      return false;
    }
    onChange(values);
    return true;
  }, [readOnly, trigger, getValues, editMode, blockingVerdict, onChange]);

  useRegisterWorkflowProceedValidator('parking', validateForProceed, !readOnly);

  useEffect(() => {
    if (readOnly) return;
    if (editMode || isValid) {
      if (
        !editMode &&
        !includedInDownpayment &&
        currentReceiptUrl.trim() &&
        receiptAiVerdictBlocksAdmin(blockingVerdict)
      ) {
        onChange(null);
        return;
      }
      onChange(getValues());
    } else {
      onChange(null);
    }
  }, [
    JSON.stringify(watched),
    isValid,
    readOnly,
    editMode,
    includedInDownpayment,
    currentReceiptUrl,
    blockingVerdict,
    onChange,
    getValues,
  ]);

  async function handleEndorsementFile(file: File) {
    setUploadingField('endorsement');
    try {
      const result = await uploadMut.mutateAsync({
        bookingId: booking.id,
        assetType: 'parking_endorsement',
        file,
      });
      setCurrentEndorsementUrl(result.url);
      setEndorsementPreviewBust(Date.now());
      setValue('parking_endorsement_url', result.url, {
        shouldValidate: true,
        shouldDirty: true,
      });
      toast.success('Parking endorsement uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload parking endorsement');
      throw err;
    } finally {
      setUploadingField(null);
    }
  }

  async function handleReceiptFile(file: File) {
    setUploadingField('receipt');
    try {
      const result = await uploadMut.mutateAsync({
        bookingId: booking.id,
        assetType: 'parking_payment_receipt',
        file,
      });
      const validation = result.receiptValidation;
      const previewBust = Date.now();
      setCurrentReceiptUrl(result.url);
      setReceiptPreviewBust(previewBust);
      stashedReceiptRef.current = {
        url: result.url,
        previewBust,
        verdict: validation?.verdict ?? null,
        summary: validation?.summary ?? '',
      };
      setValue('parking_payment_receipt_url', result.url, {
        shouldValidate: true,
        shouldDirty: true,
      });
      if (validation) {
        setReceiptAiVerdict(validation.verdict);
        setReceiptAiSummary(validation.summary);
        if (validation.aiModelError) {
          showDocumentAiModelErrorToast(validation.aiModelError);
        } else {
          const toastMsg = receiptAiUploadToastMessage(validation.verdict);
          if (toastMsg?.type === 'error') {
            toast.error(toastMsg.message, { description: toastMsg.description });
          } else if (toastMsg?.type === 'warning') toast.warning(toastMsg.message);
          else if (toastMsg?.type === 'success') toast.success(toastMsg.message);
          else toast.success('Parking payment receipt uploaded');
        }
      } else {
        toast.success('Parking payment receipt uploaded');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload parking payment receipt');
      throw err;
    } finally {
      setUploadingField(null);
    }
  }

  async function handleRemoveEndorsement() {
    setCurrentEndorsementUrl('');
    setEndorsementPreviewBust(0);
    setValue('parking_endorsement_url', '', {
      shouldValidate: true,
      shouldDirty: true,
    });
    if (readOnly) return;
    try {
      await clearAssetMut.mutateAsync({
        bookingId: booking.id,
        assetType: 'parking_endorsement',
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove endorsement');
      throw err;
    }
  }

  async function handleRemoveParkingReceipt() {
    setCurrentReceiptUrl('');
    setReceiptPreviewBust(0);
    setReceiptAiVerdict(null);
    setReceiptAiSummary('');
    stashedReceiptRef.current = null;
    setValue('parking_payment_receipt_url', '', {
      shouldValidate: true,
      shouldDirty: true,
    });
    if (readOnly) return;
    try {
      await clearAssetMut.mutateAsync({
        bookingId: booking.id,
        assetType: 'parking_payment_receipt',
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove receipt');
      throw err;
    }
  }

  const cardTitle =
    variant === 'edit' ? workflowFormEditTitle('Parking request') : 'Parking request';

  const showNonRefundableWarning = isParkingRequestDraftComplete(getValues());

  return (
    <WorkflowFormShell title={cardTitle} variant={variant} advanceMode="manual">
      <Field
        label="Parking Owner"
        required
        description="Parking owner facebook name"
        error={shownErrors.parking_owner?.message}
      >
        <input
          type="text"
          autoComplete="off"
          placeholder={FORM_PLACEHOLDERS.fullName}
          aria-invalid={!!shownErrors.parking_owner || undefined}
          className={inputClass(!!shownErrors.parking_owner, readOnly)}
          readOnly={readOnly}
          {...register('parking_owner')}
        />
      </Field>

      <Field label="Parking Rate" description="Exact parking amount guest paid">
        <input
          type="text"
          readOnly
          tabIndex={-1}
          value={formatMoney(booking.parking_rate_guest)}
          className={readOnlyInputClass()}
          aria-readonly="true"
        />
      </Field>

      <Field
        label="Owner Parking Rate"
        required
        description="Exact parking amount paid to parking owner"
        error={shownErrors.parking_rate_paid?.message}
      >
        <input
          type="number"
          min={1}
          step={10}
          placeholder={FORM_PLACEHOLDERS.parkingRate}
          aria-invalid={!!shownErrors.parking_rate_paid || undefined}
          className={inputClass(!!shownErrors.parking_rate_paid, readOnly)}
          readOnly={readOnly}
          {...register('parking_rate_paid')}
        />
      </Field>

      <Field
        label="Parking Endorsement"
        required
        error={shownErrors.parking_endorsement_url?.message}
      >
        <input type="hidden" {...register('parking_endorsement_url')} />
        <div
          aria-invalid={!!shownErrors.parking_endorsement_url || undefined}
          data-workflow-field-error={shownErrors.parking_endorsement_url ? 'true' : undefined}
          className={
            shownErrors.parking_endorsement_url
              ? 'rounded-lg ring-1 ring-red-300 dark:ring-red-500/40'
              : undefined
          }
        >
          <BookingCompactAssetControl
            label="Parking Endorsement"
            showLabel={false}
            currentUrl={currentEndorsementUrl}
            accept="image/*"
            readOnly={readOnly}
            uploading={endorsementUploading}
            removing={clearAssetMut.isPending && !receiptUploading}
            previewCacheBust={endorsementPreviewBust}
            onSelectFile={handleEndorsementFile}
            onRemove={handleRemoveEndorsement}
            onPreview={onPreview}
          />
        </div>
      </Field>

      {!readOnly ? (
        <div className="space-y-1">
          <label className="hover:bg-muted/50 -mx-1 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1 py-1">
            <Checkbox
              checked={includedInDownpayment}
              onCheckedChange={(checked) => {
                const next = checked === true;
                setValue('parking_fee_included_in_downpayment', next, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
                if (next) {
                  const url = currentReceiptUrl.trim();
                  if (url) {
                    stashedReceiptRef.current = {
                      url,
                      previewBust: receiptPreviewBust,
                      verdict: receiptAiVerdict,
                      summary: receiptAiSummary,
                    };
                  }
                  setValue('parking_payment_receipt_url', '', {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  setCurrentReceiptUrl('');
                  setReceiptPreviewBust(0);
                  setReceiptAiVerdict(null);
                  setReceiptAiSummary('');
                } else {
                  const stash = stashedReceiptRef.current;
                  const restoreUrl =
                    stash?.url.trim() || booking.parking_payment_receipt_url?.trim() || '';
                  if (restoreUrl) {
                    setCurrentReceiptUrl(restoreUrl);
                    setReceiptPreviewBust(stash?.previewBust ?? 0);
                    setReceiptAiVerdict(stash?.verdict ?? null);
                    setReceiptAiSummary(stash?.summary ?? '');
                    setValue('parking_payment_receipt_url', restoreUrl, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }
                }
              }}
            />
            <span className="text-muted-foreground text-xs leading-snug">
              Parking fee is included from downpayment receipt
            </span>
          </label>
        </div>
      ) : (
        <Field label="Parking fee payment">
          <input
            type="text"
            readOnly
            tabIndex={-1}
            value={
              includedInDownpayment
                ? 'Included in downpayment receipt'
                : 'Separate payment (receipt on file)'
            }
            className={readOnlyInputClass()}
            aria-readonly="true"
          />
        </Field>
      )}

      {!includedInDownpayment ? (
        <Field
          label="Parking Payment Receipt"
          required
          error={shownErrors.parking_payment_receipt_url?.message}
        >
          <input type="hidden" {...register('parking_payment_receipt_url')} />
          <div
            aria-invalid={!!shownErrors.parking_payment_receipt_url || undefined}
            data-workflow-field-error={shownErrors.parking_payment_receipt_url ? 'true' : undefined}
            className={
              shownErrors.parking_payment_receipt_url
                ? 'rounded-lg ring-1 ring-red-300 dark:ring-red-500/40'
                : undefined
            }
          >
            <BookingCompactAssetControl
              label="Parking Payment Receipt"
              showLabel={false}
              currentUrl={currentReceiptUrl}
              accept="image/*"
              readOnly={readOnly}
              uploading={receiptUploading}
              removing={clearAssetMut.isPending && !endorsementUploading}
              previewCacheBust={receiptPreviewBust}
              onSelectFile={handleReceiptFile}
              onRemove={handleRemoveParkingReceipt}
              onPreview={onPreview}
              footer={
                receiptAiVerdict ? (
                  <ReceiptAiVerdictBadge verdict={receiptAiVerdict} summary={receiptAiSummary} />
                ) : null
              }
            />
          </div>
        </Field>
      ) : null}

      {showNonRefundableWarning ? (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
          Parking fee is <strong>non-refundable</strong> and cannot be rescheduled after this step.
        </div>
      ) : null}
    </WorkflowFormShell>
  );
}

function inputClass(hasError: boolean, readOnly = false) {
  return [
    'h-10 w-full rounded-md border px-3 text-sm',
    'field-focus',
    readOnly
      ? 'cursor-default border-border bg-muted/50 text-foreground'
      : hasError
        ? 'border-red-400 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'
        : 'border-border bg-card',
  ].join(' ');
}

function readOnlyInputClass() {
  return [
    'h-10 w-full rounded-md border border-border bg-muted/50 px-3 text-sm text-foreground',
    'cursor-default focus:outline-none',
  ].join(' ');
}

function Field({
  label,
  required,
  description,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-muted-foreground block text-xs">
        {label}
        {required ? (
          <>
            {' '}
            <span className="text-red-600">*</span>
          </>
        ) : null}
      </label>
      {description && <p className="text-muted-foreground -mt-0.5 text-[10px]">{description}</p>}
      {children}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
