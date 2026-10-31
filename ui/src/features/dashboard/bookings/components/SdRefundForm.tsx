/**
 * SdRefundForm — Sub-form shown in WorkflowPanel when transitioning
 * PENDING_SD_REFUND → COMPLETED.
 *
 * Captures: sd_additional_expense_items / sd_additional_profit_items (label + amount),
 *           sd_refund_amount (read-only): base SD + Σ(expenses) − Σ(profits),
 *           sd_refund_receipt_url (image upload).
 *
 * Plan: docs/planning/NEW_FLOW_PLAN.md §2 (sd columns), §6.1 Q2.1
 */

import { useCallback, useEffect, useState } from 'react';

import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { BookingCompactAssetControl } from '@/features/dashboard/bookings/components/BookingCompactAssetControl';
import { GuestSdRefundDetailsSection } from '@/features/dashboard/bookings/components/GuestSdRefundDetailsSection';
import {
  ReceiptAiVerdictBadge,
  receiptAiUploadToastMessage,
  showDocumentAiModelErrorToast,
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
import type { BookingRow, SdSettlementLineItem } from '@/features/dashboard/bookings/lib/types';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

function parseNumberArray(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((v) => Number(v)).filter((n) => !Number.isNaN(n))
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseLineItemsFromBooking(raw: unknown): SdSettlementLineItem[] | null {
  let arr: unknown = raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      arr = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.map((row) => {
    if (typeof row !== 'object' || row === null) {
      return { label: '', amount: 0 };
    }
    const r = row as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label : '';
    const n = Number(r.amount);
    return {
      label,
      amount: Number.isNaN(n) ? 0 : n,
    };
  });
}

function buildInitialLineItems(booking: BookingRow): {
  expenses: SdSettlementLineItem[];
  profits: SdSettlementLineItem[];
} {
  const expJson = parseLineItemsFromBooking(booking.sd_additional_expense_items);
  const profJson = parseLineItemsFromBooking(booking.sd_additional_profit_items);
  const expFallback = parseNumberArray(booking.sd_additional_expenses).map((amount) => ({
    label: '',
    amount,
  }));
  const profFallback = parseNumberArray(booking.sd_additional_profits).map((amount) => ({
    label: '',
    amount,
  }));
  return {
    expenses: expJson ?? (expFallback.length ? expFallback : []),
    profits: profJson ?? (profFallback.length ? profFallback : []),
  };
}

function buildSdInitialState(
  booking: BookingRow,
  draft: SdRefundValues | null | undefined
): {
  expenseItems: SdSettlementLineItem[];
  profitItems: SdSettlementLineItem[];
  receiptUrl: string;
} {
  if (draft) {
    return {
      expenseItems: draft.sd_additional_expense_items.map((r) => ({ ...r })),
      profitItems: draft.sd_additional_profit_items.map((r) => ({ ...r })),
      receiptUrl: draft.sd_refund_receipt_url ?? '',
    };
  }
  const built = buildInitialLineItems(booking);
  return {
    expenseItems: built.expenses,
    profitItems: built.profits,
    receiptUrl: booking.sd_refund_receipt_url ?? '',
  };
}

export type SdRefundValues = {
  sd_additional_expense_items: SdSettlementLineItem[];
  sd_additional_profit_items: SdSettlementLineItem[];
  sd_refund_amount: number;
  sd_refund_receipt_url: string;
};

type Props = {
  booking: BookingRow;
  initialDraft?: SdRefundValues | null;
  onChange: (values: SdRefundValues | null) => void;
  readOnly?: boolean;
  editMode?: boolean;
  variant?: WorkflowFormVariant;
  /** When false, guest SD refund submission is omitted (shown separately in edit form). */
  showGuestDetails?: boolean;
  onPreview: BookingAssetPreviewHandler;
};

const SD_DEFAULT = 1500;

export function SdRefundForm({
  booking,
  initialDraft = null,
  onChange,
  readOnly = false,
  editMode = false,
  variant = 'workflow',
  showGuestDetails = true,
  onPreview,
}: Props) {
  const uploadMut = useUploadBookingAsset();
  const clearAssetMut = useClearBookingAsset();

  const sdInitial = buildSdInitialState(booking, initialDraft);

  const [expenseItems, setExpenseItems] = useState<SdSettlementLineItem[]>(
    () => sdInitial.expenseItems
  );
  const [profitItems, setProfitItems] = useState<SdSettlementLineItem[]>(
    () => sdInitial.profitItems
  );
  const [receiptUrl, setReceiptUrl] = useState<string>(() => sdInitial.receiptUrl);
  /** Only the check from this visit's upload — falls back to the stored verdict otherwise. */
  const [receiptAiVerdict, setReceiptAiVerdict] = useState<ReceiptAiVerdict>(null);
  const [receiptAiSummary, setReceiptAiSummary] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const displayedVerdict = receiptAiVerdict ?? booking.sd_refund_receipt_ai_verdict ?? null;
  const displayedSummary = receiptAiVerdict
    ? receiptAiSummary
    : booking.sd_refund_receipt_ai_summary;

  const guestMethod = booking.sd_refund_method;

  const rawBase = Number(booking.security_deposit);
  const baseSd =
    booking.security_deposit == null || booking.security_deposit === '' || Number.isNaN(rawBase)
      ? SD_DEFAULT
      : rawBase;

  const totalExpenses = expenseItems.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalProfits = profitItems.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  /** Refund = base SD + additional expenses charged to guest − profits retained from guest. */
  const netSD = baseSd + totalExpenses - totalProfits;
  const netSdError =
    submitAttempted && netSD < 0
      ? 'Refund amount cannot be negative. Adjust expenses or profits'
      : null;

  const validateForProceed = useCallback(() => {
    if (readOnly) return true;
    setSubmitAttempted(true);
    if (netSD < 0) {
      queueMicrotask(() => focusFirstWorkflowFieldError());
      return false;
    }
    onChange({
      sd_additional_expense_items: expenseItems,
      sd_additional_profit_items: profitItems,
      sd_refund_amount: Math.round(netSD * 100) / 100,
      sd_refund_receipt_url: receiptUrl,
    });
    return true;
  }, [readOnly, netSD, expenseItems, profitItems, receiptUrl, onChange]);

  useRegisterWorkflowProceedValidator('sd_refund', validateForProceed, !readOnly);

  useEffect(() => {
    setReceiptUrl(booking.sd_refund_receipt_url?.trim() ?? '');
  }, [booking.sd_refund_receipt_url]);

  useEffect(() => {
    if (readOnly) return;
    if (editMode || netSD >= 0) {
      onChange({
        sd_additional_expense_items: expenseItems,
        sd_additional_profit_items: profitItems,
        sd_refund_amount: Math.round(netSD * 100) / 100,
        sd_refund_receipt_url: receiptUrl,
      });
    } else {
      onChange(null);
    }
  }, [expenseItems, profitItems, netSD, receiptUrl, readOnly, editMode]);

  async function handleReceiptFile(file: File) {
    try {
      const result = await uploadMut.mutateAsync({
        bookingId: booking.id,
        assetType: 'sd_refund_receipt',
        file,
      });
      const validation = result.receiptValidation;
      setReceiptUrl(result.url);
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
          else toast.success('Refund receipt uploaded');
        }
      } else {
        toast.success('Refund receipt uploaded');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload refund receipt');
      throw err;
    }
  }

  async function handleRemoveReceipt() {
    setReceiptUrl('');
    setReceiptAiVerdict(null);
    setReceiptAiSummary('');
    if (readOnly) return;
    try {
      await clearAssetMut.mutateAsync({
        bookingId: booking.id,
        assetType: 'sd_refund_receipt',
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove refund receipt');
      throw err;
    }
  }

  function addExpense() {
    setExpenseItems((prev) => [...prev, { label: '', amount: 0 }]);
  }
  function addProfit() {
    setProfitItems((prev) => [...prev, { label: '', amount: 0 }]);
  }
  function removeExpense(i: number) {
    setExpenseItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function removeProfit(i: number) {
    setProfitItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function patchExpense(i: number, patch: Partial<SdSettlementLineItem>) {
    setExpenseItems((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function patchProfit(i: number, patch: Partial<SdSettlementLineItem>) {
    setProfitItems((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  const cardTitle =
    variant === 'edit' ? workflowFormEditTitle('SD settlement') : 'Security deposit settlement';

  return (
    <WorkflowFormShell
      title={cardTitle}
      variant={variant}
      bodyClassName="space-y-4"
      advanceMode="manual"
    >
      {showGuestDetails && guestMethod ? (
        <GuestSdRefundDetailsSection booking={booking} variant="workflow" />
      ) : null}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Security Deposit (base)</span>
        <span className="font-medium">{formatMoney(baseSd)}</span>
      </div>

      <LineListSection
        label="Additional Expenses"
        sign="+"
        items={expenseItems}
        onAdd={addExpense}
        onRemove={removeExpense}
        onPatch={patchExpense}
        amountPlaceholder="Amount"
        labelPlaceholder="Pool fee payment"
        readOnly={readOnly}
      />

      <LineListSection
        label="Additional Profits"
        sign="-"
        items={profitItems}
        onAdd={addProfit}
        onRemove={removeProfit}
        onPatch={patchProfit}
        amountPlaceholder="Amount"
        labelPlaceholder="Honesty store payment"
        readOnly={readOnly}
      />

      <div className="space-y-1">
        <label className="text-muted-foreground block text-xs">
          Actual Refund Amount{' '}
          <span className="text-muted-foreground font-normal">(base + expenses − profits)</span>
        </label>
        <div
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border px-3 text-sm',
            netSD < 0
              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
              : 'border-border bg-muted/50 text-foreground'
          )}
          aria-readonly="true"
          aria-invalid={!!netSdError || undefined}
          data-workflow-field-error={netSdError ? 'true' : undefined}
          tabIndex={netSdError ? -1 : undefined}
        >
          <span className="font-semibold">{formatMoney(netSD)}</span>
          {netSD < 0 && <span className="text-[11px] font-medium">Net cannot be negative</span>}
        </div>
        {netSdError ? <p className="text-[10px] text-red-600">{netSdError}</p> : null}
      </div>

      <div className="space-y-1">
        <label className="text-muted-foreground block text-xs">Refund receipt (optional)</label>
        <BookingCompactAssetControl
          label="Refund receipt"
          showLabel={false}
          currentUrl={receiptUrl}
          accept="image/*"
          readOnly={readOnly}
          uploading={uploadMut.isPending}
          removing={clearAssetMut.isPending}
          onSelectFile={handleReceiptFile}
          onRemove={handleRemoveReceipt}
          onPreview={onPreview}
        />
        <ReceiptAiVerdictBadge verdict={displayedVerdict} summary={displayedSummary} />
      </div>
    </WorkflowFormShell>
  );
}

function LineListSection({
  label,
  sign,
  items,
  onAdd,
  onRemove,
  onPatch,
  labelPlaceholder,
  amountPlaceholder,
  readOnly = false,
}: {
  label: string;
  sign: '+' | '-';
  items: SdSettlementLineItem[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onPatch: (i: number, patch: Partial<SdSettlementLineItem>) => void;
  labelPlaceholder: string;
  amountPlaceholder: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">{label}</span>
        {!readOnly ? (
          <button
            type="button"
            onClick={onAdd}
            className="text-primary hover:text-primary/90 dark:text-primary dark:hover:text-primary/90 flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium sm:min-h-0 sm:min-w-0 sm:justify-end"
          >
            <Plus className="size-3 shrink-0" /> Add
          </button>
        ) : null}
      </div>
      {items.length === 0 && <p className="text-muted-foreground text-[11px] italic">None added</p>}
      {items.map((row, i) => (
        <div key={i} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-1.5">
          <span
            className={`hidden shrink-0 text-xs font-bold sm:inline sm:w-3 ${sign === '+' ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {sign}
          </span>
          <input
            type="text"
            value={row.label}
            onChange={(e) => onPatch(i, { label: e.target.value })}
            placeholder={labelPlaceholder}
            readOnly={readOnly}
            className={cn(
              'border-border bg-card field-focus h-9 min-w-0 flex-1 rounded-md border px-2 py-1 text-[13px] leading-tight',
              readOnly && 'bg-muted/40 text-foreground cursor-default'
            )}
          />
          <div className="flex items-center gap-1.5">
            <span
              className={`shrink-0 text-xs font-bold sm:hidden ${sign === '+' ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {sign}
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={row.amount}
              onChange={(e) => onPatch(i, { amount: Number(e.target.value) })}
              placeholder={amountPlaceholder}
              readOnly={readOnly}
              className={cn(
                'border-border bg-card field-focus h-9 w-full min-w-0 flex-1 rounded-md border px-2 py-1 text-[13px] leading-tight sm:w-24 sm:min-w-[5.5rem] sm:flex-none',
                readOnly && 'bg-muted/40 text-foreground cursor-default'
              )}
            />
            {!readOnly ? (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:bg-muted flex size-11 shrink-0 items-center justify-center rounded-md hover:text-red-600"
                aria-label="Remove row"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
