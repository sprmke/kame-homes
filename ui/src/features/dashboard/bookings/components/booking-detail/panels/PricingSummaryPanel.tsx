import { Receipt, Ticket } from 'lucide-react';

import {
  formatVoucherOfferLabel,
  resolveVoucherPercentOff,
} from '@/features/guest/account/lib/voucherDiscount';
import { isStaycationVoucher, isPercentOffVoucher } from '@/features/guest/sd-form/lib/voucher';

import { DocPreview } from '@/features/dashboard/bookings/components/booking-detail/BookingDocPreview';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import { BookingDetailRowBlock } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailRow';
import { BookingPricingSummary } from '@/features/dashboard/bookings/components/BookingPricingSummary';
import { receiptAiPreviewLoading } from '@/features/dashboard/bookings/hooks/useReceiptAiBackfill';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { formatRelative } from '@/utils/format/bookingDisplay';
import { formatMoney } from '@/utils/format/currency';

type PreviewHandler = (label: string, rawUrl: string) => void;

function formatAwardedVoucherLine(code: string, amount: number | null): string {
  if (isStaycationVoucher({ code, amount: amount ?? undefined })) {
    return 'Free stay on the next booking';
  }
  if (isPercentOffVoucher({ code }) && amount != null) {
    return `${amount}% off the next booking`;
  }
  if (amount != null) {
    return `${formatMoney(amount)} off the next booking`;
  }
  return '-';
}

function AppliedVoucherBlock({ booking }: { booking: BookingRow }) {
  const code = booking.applied_voucher_code?.trim();
  if (!code) return null;
  const percent = resolveVoucherPercentOff(
    code,
    booking.applied_voucher_percent != null ? Number(booking.applied_voucher_percent) : null
  );
  const discountRaw = booking.applied_voucher_discount_php;
  const discount =
    discountRaw == null
      ? null
      : typeof discountRaw === 'string'
        ? Number(discountRaw)
        : discountRaw;

  return (
    <BookingDetailRowBlock className="border-border/60 border-t">
      <p className="text-overline mb-2">Guest voucher</p>
      <div className="border-primary/25 bg-primary/[0.04] relative overflow-hidden rounded-xl border px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="border-primary/20 bg-primary/10 text-primary inline-flex size-8 shrink-0 items-center justify-center rounded-lg border">
            <Ticket className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground font-mono text-sm font-bold tracking-wide">{code}</p>
            <p className="text-muted-foreground text-caption mt-0.5">
              {formatVoucherOfferLabel({ code, percentOff: percent })}
              {discount != null && Number.isFinite(discount) && discount > 0 ? (
                <>
                  {' · '}−{formatMoney(discount)} on booking rate
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </BookingDetailRowBlock>
  );
}

function NextStayVoucherBlock({ booking }: { booking: BookingRow }) {
  const code = booking.next_stay_voucher_code;
  if (!code) return null;
  const amountRaw = booking.next_stay_voucher_amount;
  const amount =
    amountRaw == null ? null : typeof amountRaw === 'string' ? Number(amountRaw) : amountRaw;
  const awardedAt = booking.next_stay_voucher_awarded_at;
  const redeemedAt = booking.next_stay_voucher_redeemed_at;

  return (
    <BookingDetailRowBlock className="border-border/60 border-t">
      <p className="text-overline mb-2">Next-stay voucher</p>
      <div className="border-primary/25 bg-primary/[0.04] relative overflow-hidden rounded-xl border px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="border-primary/20 bg-primary/10 text-primary inline-flex size-8 shrink-0 items-center justify-center rounded-lg border">
            <Ticket className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground font-mono text-sm font-bold tracking-wide">{code}</p>
            <p className="text-muted-foreground text-caption mt-0.5">
              {redeemedAt ? 'Redeemed on a later booking' : formatAwardedVoucherLine(code, amount)}
              {awardedAt ? (
                <>
                  {' · '}
                  <span title={awardedAt}>awarded {formatRelative(awardedAt)}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </BookingDetailRowBlock>
  );
}

export function PricingSummaryPanel({
  booking,
  onPreview,
  isReceiptAiBackfilling = false,
}: {
  booking: BookingRow;
  onPreview: PreviewHandler;
  isReceiptAiBackfilling?: boolean;
}) {
  if (booking.status === 'PENDING_REVIEW') return null;

  const isCompleted = booking.status === 'COMPLETED';
  const hasPaymentReceipt = Boolean(booking.payment_receipt_url?.trim());
  const hasBalanceReceipt = Boolean(booking.guest_balance_payment_receipt_url?.trim());

  return (
    <BookingDetailCard title="Pricing" icon={Receipt}>
      <BookingDetailRowBlock className="py-0 pb-3.5">
        <BookingPricingSummary booking={booking} layout="page" />
      </BookingDetailRowBlock>

      {booking.applied_voucher_code ? <AppliedVoucherBlock booking={booking} /> : null}

      {(hasPaymentReceipt || hasBalanceReceipt) && (
        <BookingDetailRowBlock className="border-border/60 border-t">
          <p className="text-overline mb-2">Payment receipts</p>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hasPaymentReceipt ? (
              <DocPreview
                label="Downpayment receipt"
                url={booking.payment_receipt_url!.trim()}
                onPreview={onPreview}
                receiptAiVerdict={booking.dp_receipt_ai_verdict}
                receiptAiLoading={receiptAiPreviewLoading(
                  isReceiptAiBackfilling,
                  booking.payment_receipt_url,
                  booking.dp_receipt_ai_verdict
                )}
              />
            ) : null}
            {hasBalanceReceipt ? (
              <DocPreview
                label="Payment balance receipt"
                url={booking.guest_balance_payment_receipt_url!.trim()}
                onPreview={onPreview}
                receiptAiVerdict={booking.balance_receipt_ai_verdict}
                receiptAiLoading={receiptAiPreviewLoading(
                  isReceiptAiBackfilling,
                  booking.guest_balance_payment_receipt_url,
                  booking.balance_receipt_ai_verdict
                )}
              />
            ) : null}
          </div>
        </BookingDetailRowBlock>
      )}

      {isCompleted && booking.next_stay_voucher_code ? (
        <NextStayVoucherBlock booking={booking} />
      ) : null}

      {isCompleted && booking.sd_refund_receipt_url ? (
        <BookingDetailRowBlock className="border-border/60 border-t">
          <p className="text-overline mb-2">Refund receipt</p>
          <DocPreview
            label="SD refund receipt"
            url={booking.sd_refund_receipt_url}
            onPreview={onPreview}
            receiptAiVerdict={booking.sd_refund_receipt_ai_verdict}
            receiptAiLoading={receiptAiPreviewLoading(
              isReceiptAiBackfilling,
              booking.sd_refund_receipt_url,
              booking.sd_refund_receipt_ai_verdict
            )}
          />
        </BookingDetailRowBlock>
      ) : null}
    </BookingDetailCard>
  );
}
