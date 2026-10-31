import { Ticket } from 'lucide-react';

import { formatVoucherPrizeLabel, type Voucher } from '@/features/guest/sd-form/lib/voucher';

import { formatDateToLongFormat, normalizeDateString } from '@/utils/format/dates';

function formatVoucherStayLine(checkIn: string, checkOut: string): string {
  const inLabel = formatVoucherDateLabel(checkIn);
  const outLabel = formatVoucherDateLabel(checkOut);
  if (inLabel === '-' && outLabel === '-') return '-';
  if (outLabel === '-' || !checkOut.trim()) return inLabel;
  if (inLabel === '-' || !checkIn.trim()) return outLabel;
  return `${inLabel} – ${outLabel}`;
}

function formatVoucherDateLabel(stored: string): string {
  const raw = (stored ?? '').trim();
  if (!raw) return '-';
  const normalized = normalizeDateString(raw);
  const long = formatDateToLongFormat(normalized);
  return long || raw;
}

export function RevealedVoucherCard({
  voucher,
  guestName,
  checkInDate,
  checkOutDate,
}: {
  voucher: Voucher;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
}) {
  const guestDisplay = guestName.trim() || '-';
  const stayLine = formatVoucherStayLine(checkInDate, checkOutDate);

  return (
    <div className="border-primary/25 bg-card shadow-primary/10 relative overflow-hidden rounded-2xl border shadow-md">
      <span className="bg-primary absolute inset-y-3 left-0 w-1 rounded-r-full" aria-hidden />

      <div className="space-y-4 px-4 py-4 pl-5 sm:px-5 sm:py-5 sm:pl-6">
        <div className="flex items-center gap-2.5">
          <span className="border-primary/20 bg-primary/10 text-primary inline-flex size-8 items-center justify-center rounded-lg border">
            <Ticket className="size-3.5" aria-hidden />
          </span>
          <p className="text-primary text-xs font-bold uppercase tracking-wider">You won</p>
        </div>

        <div className="space-y-1 text-center">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.18em]">
            Voucher code
          </p>
          <p className="text-foreground font-mono text-2xl font-extrabold tracking-[0.14em] sm:text-3xl">
            {voucher.code}
          </p>
          <p className="text-primary text-sm font-semibold tabular-nums">
            {formatVoucherPrizeLabel(voucher)}
          </p>
        </div>

        <div className="border-border/70 bg-muted/30 grid grid-cols-1 gap-px overflow-hidden rounded-xl border sm:grid-cols-2">
          <div className="bg-card/80 min-w-0 space-y-0.5 px-3.5 py-2.5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
              Guest
            </p>
            <p className="text-foreground break-words text-sm font-semibold leading-snug">
              {guestDisplay}
            </p>
          </div>
          <div className="bg-card/80 min-w-0 space-y-0.5 px-3.5 py-2.5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
              Stay
            </p>
            <p className="text-muted-foreground break-words text-sm leading-snug">{stayLine}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
