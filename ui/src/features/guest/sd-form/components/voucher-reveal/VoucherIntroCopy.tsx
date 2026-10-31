import { PartyPopper } from 'lucide-react';

import { formatVoucherDiscountMaxLabel, type Voucher } from '@/features/guest/sd-form/lib/voucher';
import type { VoucherRevealStyle } from '@/features/guest/sd-form/lib/voucherRevealStyle';

function headlineForStyle(style: VoucherRevealStyle): string {
  switch (style) {
    case 'wheel':
      return 'Spin the wheel for your next-stay reward!';
    case 'flip':
      return 'Flip for your next-stay reward!';
    default:
      return 'Spin for your next-stay reward!';
  }
}

export function VoucherIntroCopy({
  prizePool,
  style = 'reel',
}: {
  prizePool: ReadonlyArray<Voucher>;
  style?: VoucherRevealStyle;
}) {
  const hasFree = prizePool.some((v) => v.amount >= 100 || v.code === 'FREE-STAY');
  return (
    <div className="my-8 space-y-3">
      <div className="text-primary flex items-center justify-center gap-2">
        <PartyPopper className="size-5" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-[0.2em]">Thank you!</p>
      </div>
      <h2 className="text-foreground text-center text-xl font-bold leading-tight sm:text-2xl">
        {headlineForStyle(style)}
      </h2>
      <p className="text-muted-foreground mx-auto max-w-md text-center text-sm leading-relaxed">
        Thanks for your review! Tap below to win{' '}
        <strong className="text-primary">{formatVoucherDiscountMaxLabel(prizePool)}</strong>
        {hasFree ? (
          <>
            {' '}
            or a <strong className="text-primary">free stay</strong>
          </>
        ) : null}{' '}
        on your next booking.
      </p>
    </div>
  );
}
