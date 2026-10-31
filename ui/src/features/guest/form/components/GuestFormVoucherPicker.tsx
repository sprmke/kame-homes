import {
  GuestVoucherNoneOption,
  GuestVoucherSelectOption,
} from '@/features/guest/account/components/GuestVoucherUi';
import type { GuestVoucherDto } from '@/features/guest/account/lib/guestAccountApi';
import {
  formatVoucherOfferLabel,
  computePercentDiscountPhp,
} from '@/features/guest/account/lib/voucherDiscount';

import { cn } from '@/lib/utils';

type Props = {
  propertySlug: string | null | undefined;
  selectedSourceBookingId: string | null | undefined;
  onSelect: (sourceBookingId: string | null) => void;
  vouchers: GuestVoucherDto[];
  isLoading?: boolean;
  /** Estimated stay subtotal before voucher (host rates × nights). */
  estimatedStayPhp?: number | null;
  className?: string;
};

export function GuestFormVoucherPicker({
  propertySlug,
  selectedSourceBookingId,
  onSelect,
  vouchers,
  isLoading = false,
  estimatedStayPhp,
  className,
}: Props) {
  const enabled = Boolean(propertySlug);

  if (!enabled || isLoading || vouchers.length === 0) return null;

  return (
    <div
      className={cn('border-border/70 bg-muted/20 space-y-2.5 rounded-xl border p-3', className)}
      role="group"
      aria-label="Vouchers"
    >
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
        Voucher
      </p>
      <ul className="space-y-1.5">
        <li>
          <GuestVoucherNoneOption
            selected={!selectedSourceBookingId}
            onSelect={() => onSelect(null)}
          />
        </li>
        {vouchers.map((v) => (
          <VoucherOption
            key={v.sourceBookingId}
            voucher={v}
            selected={selectedSourceBookingId === v.sourceBookingId}
            estimatedStayPhp={estimatedStayPhp}
            onSelect={() => onSelect(v.sourceBookingId)}
          />
        ))}
      </ul>
    </div>
  );
}

function VoucherOption({
  voucher,
  selected,
  estimatedStayPhp,
  onSelect,
}: {
  voucher: GuestVoucherDto;
  selected: boolean;
  estimatedStayPhp?: number | null;
  onSelect: () => void;
}) {
  const offer = formatVoucherOfferLabel({
    code: voucher.code,
    percentOff: voucher.percentOff,
    legacyAmountPhp: voucher.legacyAmountPhp,
  });
  const discount =
    estimatedStayPhp != null && voucher.percentOff > 0
      ? computePercentDiscountPhp(estimatedStayPhp, voucher.percentOff)
      : estimatedStayPhp != null && voucher.legacyAmountPhp
        ? Math.min(estimatedStayPhp, voucher.legacyAmountPhp)
        : null;

  return (
    <li>
      <GuestVoucherSelectOption
        selected={selected}
        onSelect={onSelect}
        title={offer}
        subtitle={voucher.code}
        discountPhp={discount}
      />
    </li>
  );
}
