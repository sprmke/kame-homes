/**
 * Closing record for the last stage of the deck.
 *
 * Every other stage answers "what's next"; COMPLETED has no next, so the rail
 * would otherwise sit empty under the header. This states what the booking
 * closed with — the date, what the guest settled at check-out, and what went
 * back to them — which is the same question a host opens a finished booking to
 * answer. Refund method, bank details and guest feedback stay on the Pricing
 * tab; this card carries only the facts the workflow itself produced.
 */

import { WorkflowSubFormCard } from '@/features/dashboard/bookings/components/WorkflowSubFormCard';
import type { BookingAssetPreviewHandler } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import { guestBalancePaidRecorded } from '@/features/dashboard/bookings/lib/totalGuestBalance';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { workflowInlineLink } from '@/features/dashboard/bookings/lib/workflowActionButtonStyles';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';
import { formatManilaLongDate } from '@/utils/format/dates';

function toAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(n) ? null : n;
}

function SummaryRow({
  label,
  value,
  numeric,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn('text-foreground min-w-0 text-right font-medium', numeric && 'tabular-nums')}
      >
        {value}
      </span>
    </div>
  );
}

export function WorkflowCompletedSummaryCard({
  booking,
  plain = false,
  onPreview,
}: {
  booking: BookingRow;
  plain?: boolean;
  onPreview: BookingAssetPreviewHandler;
}) {
  const completedOn = formatManilaLongDate(booking.status_updated_at ?? booking.updated_at);
  const balanceCollected = guestBalancePaidRecorded(booking);
  const depositReturned = toAmount(booking.sd_refund_amount);
  const receiptUrl = booking.sd_refund_receipt_url?.trim() ?? '';

  if (!completedOn && balanceCollected <= 0 && depositReturned === null) return null;

  return (
    <WorkflowSubFormCard title="Closing summary" plain={plain} bodyClassName="px-4 py-3 sm:px-5">
      <div className="divide-border/60 divide-y">
        {completedOn ? <SummaryRow label="Completed" value={completedOn} /> : null}
        {balanceCollected > 0 ? (
          <SummaryRow numeric label="Balance collected" value={formatMoney(balanceCollected)} />
        ) : null}
        {depositReturned !== null ? (
          <SummaryRow numeric label="Deposit returned" value={formatMoney(depositReturned)} />
        ) : null}
      </div>
      {receiptUrl ? (
        <button
          type="button"
          onClick={() => void onPreview('Refund receipt', receiptUrl)}
          className={cn(workflowInlineLink, 'mt-3 inline-flex items-center gap-1.5')}
        >
          View refund receipt
        </button>
      ) : null}
    </WorkflowSubFormCard>
  );
}
