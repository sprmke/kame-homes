import { useEffect } from 'react';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

import {
  ReceiptAiVerdictBanner,
  type DocumentAiVerdictVariant,
  type ReceiptAiVerdict,
} from '@/features/dashboard/bookings/components/ReceiptAiVerdictBadge';
import { receiptAiPreviewLoading } from '@/features/dashboard/bookings/hooks/useReceiptAiBackfill';
import { ADMIN_GUEST_VIEW_SLOTS } from '@/features/dashboard/bookings/lib/adminGuestSlots';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { MediaPreviewSkeleton } from '@/components/skeletons/AdminSkeletons';
import { cn } from '@/lib/utils';

/** Modal shell height — shared by image + PDF preview bodies. */
const ASSET_PREVIEW_MODAL_H =
  'h-[min(90dvh,calc(100dvh-1.5rem))] max-h-[min(90dvh,calc(100dvh-1.5rem))]';

/** PDF iframe fills the scrollable body below the header. */
const ASSET_PREVIEW_PDF_H = 'h-full min-h-[min(50dvh,20rem)]';

export function receiptAiMetaForPreviewAsset(
  booking: BookingRow | null | undefined,
  asset: { label: string; rawUrl: string } | null,
  isBackfilling: boolean
): {
  verdict: ReceiptAiVerdict;
  summary: string | null;
  loading: boolean;
  variant: DocumentAiVerdictVariant;
} | null {
  if (!booking || !asset) return null;

  const raw = asset.rawUrl.trim();
  const matches = (stored: string | null | undefined) =>
    Boolean(stored?.trim() && stored.trim() === raw);

  if (asset.label === 'Downpayment receipt' || matches(booking.payment_receipt_url)) {
    return {
      verdict: booking.dp_receipt_ai_verdict,
      summary: booking.dp_receipt_ai_summary?.trim() || null,
      loading: receiptAiPreviewLoading(
        isBackfilling,
        booking.payment_receipt_url,
        booking.dp_receipt_ai_verdict
      ),
      variant: 'receipt',
    };
  }

  if (
    asset.label === 'Payment balance receipt' ||
    matches(booking.guest_balance_payment_receipt_url)
  ) {
    return {
      verdict: booking.balance_receipt_ai_verdict,
      summary: booking.balance_receipt_ai_summary?.trim() || null,
      loading: receiptAiPreviewLoading(
        isBackfilling,
        booking.guest_balance_payment_receipt_url,
        booking.balance_receipt_ai_verdict
      ),
      variant: 'receipt',
    };
  }

  if (
    asset.label === 'Parking Payment Receipt' ||
    asset.label === 'Parking payment receipt' ||
    matches(booking.parking_payment_receipt_url)
  ) {
    return {
      verdict: booking.parking_receipt_ai_verdict,
      summary: booking.parking_receipt_ai_summary?.trim() || null,
      loading: receiptAiPreviewLoading(
        isBackfilling,
        booking.parking_payment_receipt_url,
        booking.parking_receipt_ai_verdict
      ),
      variant: 'receipt',
    };
  }

  for (const slot of ADMIN_GUEST_VIEW_SLOTS) {
    const url = booking[slot.validIdUrlKey];
    const isPrimary = slot.index === 1;
    const labelMatch =
      (isPrimary && asset.label === 'Valid ID') ||
      asset.label === `${slot.label} valid ID` ||
      asset.label === `${slot.label} guest valid ID`;
    if (!labelMatch && !matches(url)) continue;
    const verdictKey = slot.validIdAiVerdictKey;
    const summaryKey = slot.validIdAiSummaryKey;
    if (!verdictKey) return null;
    return {
      verdict: booking[verdictKey],
      summary: (summaryKey ? booking[summaryKey]?.trim() : null) || null,
      loading: receiptAiPreviewLoading(isBackfilling, url, booking[verdictKey]),
      variant: 'valid_id',
    };
  }

  return null;
}

export function BookingDetailAssetPreviewModal({
  asset,
  booking,
  isReceiptAiBackfilling = false,
  loading,
  onClose,
}: {
  asset: {
    label: string;
    url: string;
    rawUrl: string;
    type: 'image' | 'pdf' | 'file';
  } | null;
  booking: BookingRow | null | undefined;
  isReceiptAiBackfilling?: boolean;
  loading: boolean;
  onClose: () => void;
}) {
  const open = Boolean(asset || loading);
  const receiptAi = receiptAiMetaForPreviewAsset(booking, asset, isReceiptAiBackfilling);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="bg-background/80 fixed inset-0 z-[200] flex items-center justify-center overflow-hidden p-3 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={asset ? `Preview ${asset.label}` : 'Loading preview'}
      onClick={onClose}
    >
      <div
        className={cn(
          'border-border bg-card mx-auto flex w-full max-w-[min(calc(100vw-1.5rem),56rem)] flex-col overflow-hidden rounded-xl border shadow-2xl',
          ASSET_PREVIEW_MODAL_H
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-separator flex min-h-[52px] shrink-0 items-center justify-between gap-2 border-b px-2.5 sm:min-h-[56px] sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="text-foreground truncate text-xs font-semibold sm:text-sm">
              {asset?.label ?? 'Loading preview...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {asset && (
              <a
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border text-ui hover:bg-muted/50 inline-flex min-h-[40px] items-center justify-center rounded-lg border px-2 font-medium sm:min-h-[44px] sm:px-3"
              >
                Open in new tab
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="border-border text-muted-foreground hover:bg-muted/50 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border sm:min-h-[44px] sm:min-w-[44px]"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        {receiptAi ? (
          <ReceiptAiVerdictBanner
            verdict={receiptAi.verdict}
            summary={receiptAi.summary}
            loading={receiptAi.loading}
          />
        ) : null}
        <div className="bg-muted flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain p-1.5 sm:min-h-[12rem] sm:p-3">
          {loading && <MediaPreviewSkeleton className="w-full flex-1" />}

          {!loading && asset?.type === 'image' && (
            <div className="bg-card flex h-full min-h-0 w-full items-center justify-center rounded-lg p-2">
              <img
                src={asset.url}
                alt={asset.label}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}

          {!loading && asset?.type !== 'image' && asset && (
            <iframe
              title={asset.label}
              src={asset.url}
              className={cn('bg-card w-full rounded-lg', ASSET_PREVIEW_PDF_H)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
