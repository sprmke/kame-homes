import { Link } from 'react-router-dom';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import {
  GuestVoucherWalletCard,
  GuestVoucherWalletIcon,
} from '@/features/guest/account/components/GuestVoucherUi';
import { useGuestVouchersQuery } from '@/features/guest/account/hooks/useGuestVouchersQuery';
import { formatVoucherOfferLabel } from '@/features/guest/account/lib/voucherDiscount';
import { guestFormPath } from '@/features/guest/lib/guestPublicPaths';

import { GuestVouchersPageSkeleton } from '@/components/skeletons/GuestAccountSkeletons';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/utils/format/bookingDisplay';

function WalletVoucherRow({
  propertyName,
  code,
  offer,
  meta,
  metaTitle,
  bookHref,
  active,
}: {
  propertyName: string;
  code: string;
  offer: string;
  meta?: string | null;
  metaTitle?: string | null;
  bookHref?: string;
  active: boolean;
}) {
  return (
    <GuestVoucherWalletCard active={active}>
      <div className={cn('flex items-center gap-2.5', active && 'pl-1.5')}>
        <GuestVoucherWalletIcon active={active} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={cn(
                'truncate font-mono text-sm font-bold tracking-wide',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {code}
            </p>
            <p
              className={cn(
                'shrink-0 text-xs font-semibold tabular-nums',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {offer}
            </p>
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {propertyName}
            {meta ? (
              <>
                <span aria-hidden> · </span>
                <span title={metaTitle ?? undefined}>{meta}</span>
              </>
            ) : null}
          </p>
          {bookHref ? (
            <Link
              to={bookHref}
              className="text-primary mt-1.5 inline-flex min-h-[44px] items-center text-xs font-semibold underline-offset-4 hover:underline sm:min-h-0 sm:py-0.5"
            >
              Book again
            </Link>
          ) : null}
        </div>
      </div>
    </GuestVoucherWalletCard>
  );
}

export function GuestVouchersPage() {
  usePageTitle(publicPageTitle('Vouchers'));
  const { data: vouchers = [], isLoading } = useGuestVouchersQuery({ includeRedeemed: true });

  const available = vouchers.filter((v) => !v.redeemedAt);
  const used = vouchers.filter((v) => v.redeemedAt);

  if (isLoading) {
    return (
      <GuestAccountContentCard>
        <GuestVouchersPageSkeleton rows={4} />
      </GuestAccountContentCard>
    );
  }

  if (vouchers.length === 0) {
    return (
      <GuestAccountEmptyState
        message="No vouchers yet."
        actionLabel="Browse properties"
        actionHref="/properties"
      />
    );
  }

  return (
    <GuestAccountContentCard>
      <div className="space-y-5">
        {available.length > 0 ? (
          <section className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Ready to use
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {available.map((v) => {
                const offer = formatVoucherOfferLabel({
                  code: v.code,
                  percentOff: v.percentOff,
                  legacyAmountPhp: v.legacyAmountPhp,
                });
                const bookHref = v.propertySlug ? guestFormPath(v.propertySlug) : '/properties';
                return (
                  <li key={v.sourceBookingId}>
                    <WalletVoucherRow
                      active
                      propertyName={v.propertyName ?? 'Property'}
                      code={v.code}
                      offer={offer}
                      meta={v.awardedAt ? `Awarded ${formatRelative(v.awardedAt)}` : null}
                      metaTitle={v.awardedAt}
                      bookHref={bookHref}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {used.length > 0 ? (
          <section className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Used
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {used.map((v) => {
                const offer = formatVoucherOfferLabel({
                  code: v.code,
                  percentOff: v.percentOff,
                  legacyAmountPhp: v.legacyAmountPhp,
                });
                return (
                  <li key={v.sourceBookingId}>
                    <WalletVoucherRow
                      active={false}
                      propertyName={v.propertyName ?? 'Property'}
                      code={v.code}
                      offer={offer}
                      meta={v.redeemedAt ? `Used ${formatRelative(v.redeemedAt)}` : 'Used'}
                      metaTitle={v.redeemedAt}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </GuestAccountContentCard>
  );
}
