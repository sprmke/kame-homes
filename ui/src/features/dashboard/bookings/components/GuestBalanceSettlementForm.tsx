/**
 * GuestBalanceSettlementForm — Shown when advancing READY_FOR_CHECKIN →
 * READY_FOR_CHECKOUT. Requires **balance amount paid** to **equal** total
 * guest balance (Facebook: rate − down + SD + pet + additional; Airbnb:
 * pet + additional only). Parking excluded — settled on Parking Request.
 * Payment balance receipt is required only when total > ₱0.
 */

import { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';

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
import { useUpdateBooking } from '@/features/dashboard/bookings/hooks/useUpdateBooking';
import { useUploadBookingAsset } from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';
import {
  resolveAssetUrlForBrowser,
  isStorageObjectNotFoundError,
} from '@/features/dashboard/bookings/lib/storageUrls';
import {
  computeTotalGuestBalance,
  guestBalancePaymentReceiptRequired,
} from '@/features/dashboard/bookings/lib/totalGuestBalance';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

export type GuestBalanceSettlementValues = {
  guest_balance_paid_amount: number;
  /** Empty when total guest balance is ₱0 and no receipt was uploaded. */
  guest_balance_payment_receipt_url: string;
};

type Props = {
  booking: BookingRow;
  initialDraft?: GuestBalanceSettlementValues | null;
  onChange: (values: GuestBalanceSettlementValues | null) => void;
  readOnly?: boolean;
  /** Booking edit form: skip RFCI auto-save and strict settlement validation. */
  editMode?: boolean;
  variant?: WorkflowFormVariant;
  onPreview: BookingAssetPreviewHandler;
};

function defaultPaidFromBooking(booking: BookingRow): number {
  const bal = computeTotalGuestBalance(booking);
  if (bal === null) return 0;
  if (bal === 0) return 0;
  const saved = booking.guest_balance_paid_amount;
  if (saved !== null && saved !== undefined && saved !== '') {
    const p = typeof saved === 'string' ? Number(saved) : saved;
    if (!Number.isNaN(p) && p >= 0) return Math.round(p * 100) / 100;
  }
  return Math.round(bal * 100) / 100;
}

function parsePaidInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function GuestBalanceSettlementForm({
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
  const savePaidMut = useUpdateBooking();

  const totalDue = computeTotalGuestBalance(booking);
  const receiptRequired = totalDue !== null && guestBalancePaymentReceiptRequired(totalDue);
  const [paidInput, setPaidInput] = useState(() => {
    if (initialDraft) return String(initialDraft.guest_balance_paid_amount);
    const b = computeTotalGuestBalance(booking);
    if (b === null) return '';
    return String(defaultPaidFromBooking(booking));
  });
  const [receiptUrl, setReceiptUrl] = useState(
    () =>
      initialDraft?.guest_balance_payment_receipt_url?.trim() ??
      booking.guest_balance_payment_receipt_url?.trim() ??
      ''
  );
  const [receiptImgSrc, setReceiptImgSrc] = useState<string | null>(null);
  const [receiptImgFailed, setReceiptImgFailed] = useState(false);
  const [receiptPreviewBust, setReceiptPreviewBust] = useState(0);
  /** Only the check from this visit's upload — not a stored verdict from an earlier step. */
  const [receiptAiVerdict, setReceiptAiVerdict] = useState<ReceiptAiVerdict>(null);
  const [receiptAiSummary, setReceiptAiSummary] = useState('');
  const blockingVerdict = receiptAiVerdict ?? booking.balance_receipt_ai_verdict ?? null;
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!receiptUrl.trim()) {
      setReceiptImgSrc(null);
      setReceiptImgFailed(false);
      return;
    }
    let cancelled = false;
    setReceiptImgSrc(null);
    setReceiptImgFailed(false);
    resolveAssetUrlForBrowser(receiptUrl)
      .then((u) => {
        if (!cancelled) setReceiptImgSrc(u);
      })
      .catch((err) => {
        if (!cancelled) {
          if (isStorageObjectNotFoundError(err)) {
            setReceiptImgSrc(null);
            setReceiptImgFailed(true);
            return;
          }
          setReceiptImgSrc(receiptUrl);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [receiptUrl, receiptPreviewBust]);

  useEffect(() => {
    if (totalDue === 0 && paidInput !== '0') {
      setPaidInput('0');
    }
  }, [totalDue, paidInput]);

  useEffect(() => {
    if (initialDraft) return;
    setReceiptUrl(booking.guest_balance_payment_receipt_url?.trim() ?? '');
  }, [booking.guest_balance_payment_receipt_url, initialDraft]);

  // Persist paid amount on RFCI so sd-refund-cron can auto-advance status once settlement matches total.
  useEffect(() => {
    if (readOnly || editMode) return;
    if (booking.status !== 'READY_FOR_CHECKIN') return;
    const paidParsed = parsePaidInput(paidInput);
    if (paidParsed === null || paidParsed < 0 || totalDue === null) return;
    const paidCents = Math.round(paidParsed * 100);
    const balCents = Math.round(totalDue * 100);
    if (paidCents > balCents) return;

    const prev = booking.guest_balance_paid_amount;
    const prevNum = prev === null || prev === undefined || prev === '' ? NaN : Number(prev);
    if (!Number.isNaN(prevNum) && Math.round(prevNum * 100) === paidCents) return;

    const t = setTimeout(() => {
      savePaidMut.mutate({
        bookingId: booking.id,
        currentStatus: booking.status,
        payload: { guest_balance_paid_amount: paidCents / 100 },
      });
    }, 600);
    return () => clearTimeout(t);
  }, [
    paidInput,
    totalDue,
    booking.id,
    booking.status,
    booking.guest_balance_paid_amount,
    readOnly,
    editMode,
  ]);

  useEffect(() => {
    if (readOnly) return;
    if (totalDue === null) {
      onChange(null);
      return;
    }

    const balCents = Math.round(totalDue * 100);
    let paidParsed = parsePaidInput(paidInput);
    if (paidParsed === null) {
      if (balCents === 0) paidParsed = 0;
      else if (editMode) {
        onChange(null);
        return;
      } else {
        onChange(null);
        return;
      }
    }
    if (paidParsed < 0) {
      onChange(null);
      return;
    }

    const paidCents = Math.round(paidParsed * 100);
    if (editMode) {
      const receipt = receiptRequired ? receiptUrl.trim() : '';
      onChange({
        guest_balance_paid_amount: Math.round(paidParsed * 100) / 100,
        guest_balance_payment_receipt_url: receipt,
      });
      return;
    }

    if (paidCents > balCents) {
      onChange(null);
      return;
    }
    if (paidCents !== balCents) {
      onChange(null);
      return;
    }

    const receipt = receiptRequired ? receiptUrl.trim() : '';
    if (receiptRequired && !receipt) {
      onChange(null);
      return;
    }
    if (receiptRequired && receipt && receiptAiVerdictBlocksAdmin(blockingVerdict)) {
      onChange(null);
      return;
    }

    onChange({
      guest_balance_paid_amount: Math.round(paidParsed * 100) / 100,
      guest_balance_payment_receipt_url: receipt,
    });
  }, [
    totalDue,
    paidInput,
    receiptUrl,
    receiptRequired,
    blockingVerdict,
    onChange,
    readOnly,
    editMode,
  ]);

  const paidUi = parsePaidInput(paidInput) ?? NaN;
  const paidCentsUi = totalDue !== null && !Number.isNaN(paidUi) ? Math.round(paidUi * 100) : null;
  const balCentsUi = totalDue !== null ? Math.round(totalDue * 100) : null;

  function resolvePaidError(): string | null {
    if (totalDue === null) return 'Complete pricing first';
    if (paidInput.trim() === '' && totalDue !== 0) return 'Enter balance amount paid';
    if (Number.isNaN(paidUi) || paidUi < 0) return 'Enter a valid amount';
    if (paidCentsUi !== null && balCentsUi !== null && paidCentsUi > balCentsUi) {
      return 'Amount paid cannot exceed total guest balance';
    }
    if (paidCentsUi !== null && balCentsUi !== null && paidCentsUi !== balCentsUi) {
      return 'Amount paid must equal total guest balance';
    }
    return null;
  }

  function resolveReceiptError(): string | null {
    if (!receiptRequired) return null;
    if (!receiptUrl.trim()) return 'Upload a payment balance receipt';
    if (receiptAiVerdictBlocksAdmin(blockingVerdict)) {
      return 'Replace the receipt. AI check blocked this file';
    }
    return null;
  }

  const paidError = submitAttempted ? resolvePaidError() : null;
  const receiptError = submitAttempted && !resolvePaidError() ? resolveReceiptError() : null;

  const validateForProceed = useCallback(() => {
    if (readOnly) return true;
    setSubmitAttempted(true);
    const nextPaidError = (() => {
      if (totalDue === null) return 'Complete pricing first';
      const paid = parsePaidInput(paidInput);
      if ((paid === null || Number.isNaN(paid)) && totalDue !== 0)
        return 'Enter balance amount paid';
      if (paid !== null && paid < 0) return 'Enter a valid amount';
      const paidCents = paid === null ? (totalDue === 0 ? 0 : null) : Math.round(paid * 100);
      const balCents = Math.round(totalDue * 100);
      if (paidCents === null) return 'Enter balance amount paid';
      if (paidCents > balCents) return 'Amount paid cannot exceed total guest balance';
      if (paidCents !== balCents) return 'Amount paid must equal total guest balance';
      return null;
    })();
    const nextReceiptError = (() => {
      if (nextPaidError) return null;
      if (!receiptRequired) return null;
      if (!receiptUrl.trim()) return 'Upload a payment balance receipt';
      if (receiptAiVerdictBlocksAdmin(blockingVerdict)) {
        return 'Replace the receipt. AI check blocked this file';
      }
      return null;
    })();
    if (nextPaidError || nextReceiptError) {
      const hint = nextPaidError || nextReceiptError;
      if (hint) toast.error(hint);
      queueMicrotask(() => focusFirstWorkflowFieldError());
      return false;
    }
    const paidParsed = parsePaidInput(paidInput) ?? (totalDue === 0 ? 0 : 0);
    onChange({
      guest_balance_paid_amount: Math.round(paidParsed * 100) / 100,
      guest_balance_payment_receipt_url: receiptRequired ? receiptUrl.trim() : '',
    });
    return true;
  }, [readOnly, totalDue, paidInput, receiptRequired, receiptUrl, blockingVerdict, onChange]);

  useRegisterWorkflowProceedValidator('guest_balance', validateForProceed, !readOnly);

  let paidFieldClass = 'border-border bg-card';
  if (paidError) {
    paidFieldClass =
      'border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300';
  } else if (
    totalDue !== null &&
    paidInput !== '' &&
    !Number.isNaN(paidUi) &&
    paidCentsUi !== null &&
    balCentsUi !== null
  ) {
    if (paidCentsUi > balCentsUi) {
      paidFieldClass =
        'border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300';
    } else if (paidCentsUi < balCentsUi) {
      paidFieldClass =
        'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200';
    }
  }

  async function handleRemoveReceipt() {
    setReceiptUrl('');
    setReceiptAiVerdict(null);
    setReceiptAiSummary('');
    setReceiptPreviewBust(0);
    setReceiptImgSrc(null);
    setReceiptImgFailed(false);

    if (readOnly) return;

    try {
      await clearAssetMut.mutateAsync({
        bookingId: booking.id,
        assetType: 'guest_balance_payment_receipt',
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove receipt');
      throw err;
    }
  }

  async function handleReceiptFile(file: File) {
    try {
      const result = await uploadMut.mutateAsync({
        bookingId: booking.id,
        assetType: 'guest_balance_payment_receipt',
        file,
      });
      setReceiptUrl(result.url);
      setReceiptPreviewBust(Date.now());
      const validation = result.receiptValidation;
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
          else toast.success('Payment balance receipt uploaded');
        }
      } else {
        toast.success('Payment balance receipt uploaded');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload receipt');
      throw err;
    }
  }

  const cardTitle =
    variant === 'edit'
      ? workflowFormEditTitle('Guest balance settlement')
      : 'Guest balance settlement';

  return (
    <WorkflowFormShell
      title={cardTitle}
      variant={variant}
      bodyClassName="space-y-4"
      advanceMode="manual"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">Total guest balance</span>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
            totalDue === null
              ? 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30'
              : 'bg-muted text-foreground dark:ring-border/60 ring-slate-200'
          )}
        >
          {totalDue === null ? 'Missing. Complete pricing first' : formatMoney(totalDue)}
        </span>
      </div>

      <div className="space-y-1">
        <label htmlFor="guest-balance-paid" className="text-muted-foreground block text-xs">
          Balance amount paid <span className="text-red-600">*</span>
        </label>
        <input
          id="guest-balance-paid"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          disabled={totalDue === null || readOnly}
          readOnly={readOnly}
          value={paidInput}
          aria-invalid={!!paidError || undefined}
          onChange={(e) => setPaidInput(e.target.value)}
          className={cn('h-10 w-full rounded-md border px-3 text-sm', paidFieldClass)}
        />
        {paidError ? <p className="text-[10px] text-red-600">{paidError}</p> : null}
      </div>

      <div className="space-y-1">
        <span className="text-muted-foreground block text-xs">
          Payment balance receipt
          {receiptRequired ? (
            <>
              {' '}
              <span className="text-red-600">*</span>
            </>
          ) : null}
        </span>
        <div
          aria-invalid={!!receiptError || undefined}
          data-workflow-field-error={receiptError ? 'true' : undefined}
          className={cn(receiptError && 'rounded-lg ring-1 ring-red-300 dark:ring-red-500/40')}
        >
          <BookingCompactAssetControl
            label="Payment balance receipt"
            showLabel={false}
            currentUrl={receiptUrl}
            accept="image/*"
            readOnly={readOnly}
            disabled={totalDue === null}
            uploading={uploadMut.isPending}
            removing={clearAssetMut.isPending}
            previewCacheBust={receiptPreviewBust}
            thumbSrc={receiptImgSrc}
            thumbPending={Boolean(receiptUrl.trim()) && !receiptImgSrc && !receiptImgFailed}
            suppressNormalizedThumb={receiptImgFailed}
            onSelectFile={handleReceiptFile}
            onRemove={handleRemoveReceipt}
            onPreview={onPreview}
            footer={
              receiptRequired && receiptAiVerdict ? (
                <ReceiptAiVerdictBadge verdict={receiptAiVerdict} summary={receiptAiSummary} />
              ) : null
            }
          />
        </div>
        {receiptError ? <p className="text-[10px] text-red-600">{receiptError}</p> : null}
      </div>
    </WorkflowFormShell>
  );
}
