import type { ReactNode } from 'react';

import { Check, Ticket } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

/** Shared selectable row for guest voucher pickers (form, wallet actions). */
export function GuestVoucherSelectOption({
  selected,
  onSelect,
  title,
  subtitle,
  discountPhp,
  children,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  discountPhp?: number | null;
  children?: ReactNode;
  className?: string;
}) {
  const showDiscount = discountPhp != null && discountPhp > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group relative flex min-h-[44px] w-full items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
        selected
          ? 'border-primary/50 bg-primary/5 shadow-soft ring-primary/25 ring-1'
          : 'border-border/70 bg-card hover:border-primary/25 hover:bg-muted/30',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute inset-y-1.5 left-0 w-1 rounded-r-full transition-colors',
          selected ? 'bg-primary' : 'bg-border/80 group-hover:bg-primary/35'
        )}
        aria-hidden
      />

      <span
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
          selected
            ? 'border-primary/30 bg-primary-strong text-primary-foreground'
            : 'border-border/80 bg-muted/50 text-muted-foreground group-hover:border-primary/20 group-hover:text-primary'
        )}
        aria-hidden
      >
        {selected ? (
          <Check className="size-3.5" strokeWidth={2.5} />
        ) : (
          <Ticket className="size-3.5" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-sm font-semibold leading-snug">{title}</span>
        {subtitle ? (
          <span className="text-muted-foreground mt-0.5 block font-mono text-[11px] tracking-wide">
            {subtitle}
          </span>
        ) : null}
        {children}
      </span>

      {showDiscount ? (
        <span className="bg-primary/10 text-primary shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums">
          −{formatMoney(discountPhp)}
        </span>
      ) : null}
    </button>
  );
}

/** Compact “None” row for optional voucher opt-out. */
export function GuestVoucherNoneOption({
  selected,
  onSelect,
}: {
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-all duration-200',
        selected
          ? 'border-border bg-muted/50 text-foreground ring-border font-medium ring-1'
          : 'border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/30'
      )}
    >
      <span
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-foreground/30 bg-foreground/10' : 'border-border bg-background'
        )}
        aria-hidden
      >
        {selected ? <span className="bg-foreground size-1.5 rounded-full" /> : null}
      </span>
      None
    </button>
  );
}

export function GuestVoucherEstimateSummary({
  offerLabel,
  estimatedStayPhp,
  discountPhp,
  className,
}: {
  offerLabel: string;
  estimatedStayPhp: number;
  discountPhp: number;
  className?: string;
}) {
  const afterVoucher = Math.max(0, estimatedStayPhp - discountPhp);

  return (
    <div
      className={cn(
        'border-primary/20 bg-primary/[0.04] relative overflow-hidden rounded-xl border px-3.5 py-3',
        className
      )}
    >
      <span
        className="via-primary/35 pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent"
        aria-hidden
      />
      <p className="text-foreground text-sm font-semibold">{offerLabel}</p>
      <dl className="text-muted-foreground mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt>Estimated stay</dt>
          <dd className="text-foreground tabular-nums">{formatMoney(estimatedStayPhp)}</dd>
        </div>
        {discountPhp > 0 ? (
          <div className="text-primary flex justify-between gap-3 font-medium">
            <dt>Voucher</dt>
            <dd className="tabular-nums">−{formatMoney(discountPhp)}</dd>
          </div>
        ) : null}
        <div className="border-primary/15 text-foreground flex justify-between gap-3 border-t pt-1.5 font-semibold">
          <dt>After voucher</dt>
          <dd className="tabular-nums">{formatMoney(afterVoucher)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Wallet / account voucher card shell — compact ticket row. */
export function GuestVoucherWalletCard({
  active = true,
  children,
  className,
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border px-3 py-2.5 transition-colors',
        active ? 'border-primary/25 bg-card shadow-sm' : 'border-border/70 bg-muted/20 opacity-90',
        className
      )}
    >
      {active ? (
        <span className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-r-full" aria-hidden />
      ) : null}
      {children}
    </div>
  );
}

export function GuestVoucherWalletIcon({
  active = true,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border',
        active
          ? 'border-primary/20 bg-primary/10 text-primary'
          : 'border-border/70 bg-muted text-muted-foreground',
        className
      )}
      aria-hidden
    >
      <Ticket className="size-3.5" />
    </span>
  );
}
