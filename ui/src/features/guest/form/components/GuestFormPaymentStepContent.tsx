import { useCallback, useMemo } from 'react';

import { toast } from 'sonner';

import {
  useGuestPaymentInfo,
  type GuestPaymentMethod,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { computeGuestFormPaymentBreakdown } from '@/features/guest/form/lib/guestFormPayment';
import type { GuestFormData } from '@/features/guest/form/schemas/guestFormSchema';

import { InlineCopyIconButton } from '@/features/dashboard/bookings/components/InlineCopyIconButton';
import { isPlatformSeedMediaUrl } from '@/features/dashboard/lib/storedMediaDisplay';
import {
  DEFAULT_PAYMENT_PROVIDER,
  normalizePaymentProvider,
  paymentAccountNumberLabel,
  paymentQrAltText,
  paymentSectionTitle,
} from '@/features/dashboard/org/lib/paymentProviders';

import { formatMoney } from '@/utils/format/currency';

import type { UseFormReturn } from 'react-hook-form';

function guestFacingQrUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed || isPlatformSeedMediaUrl(trimmed)) return null;
  return trimmed;
}

function PaymentMethodCard({ method }: { method: GuestPaymentMethod }) {
  const paymentProvider = normalizePaymentProvider(method.provider);
  const accountName = method.accountName;
  const accountNumber = method.accountNumber;
  const paymentQrSrc = guestFacingQrUrl(method.qrImageUrl);
  const accountNumberLabel = paymentAccountNumberLabel(paymentProvider);
  const payTitle = paymentSectionTitle(paymentProvider);

  const copyAccountName = useCallback(async () => {
    if (!accountName) return;
    try {
      await navigator.clipboard.writeText(accountName);
      toast.success('Account name copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [accountName]);

  const copyAccountNumber = useCallback(async () => {
    if (!accountNumber) return;
    try {
      await navigator.clipboard.writeText(accountNumber);
      toast.success('Account Number copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [accountNumber]);

  return (
    <div className="space-y-3">
      <p className="text-foreground text-sm font-semibold">{payTitle}</p>
      <div
        className={
          paymentQrSrc
            ? 'grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch md:gap-5'
            : 'grid grid-cols-1 gap-4'
        }
      >
        <div
          className="border-border/60 bg-card flex min-w-0 flex-col justify-center gap-4 rounded-xl border px-4 py-5 sm:px-5 sm:py-6"
          aria-label={`${paymentProvider} account details`}
        >
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Account name
            </p>
            <span className="text-foreground inline-flex max-w-full flex-wrap items-baseline gap-x-1 gap-y-0.5 text-base font-semibold leading-snug sm:text-lg">
              <span className="min-w-0 break-words">{accountName}</span>
              <InlineCopyIconButton
                aria-label="Copy account name to clipboard"
                disabled={!accountName}
                onClick={() => void copyAccountName()}
              />
            </span>
          </div>
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {accountNumberLabel}
            </p>
            <span className="text-foreground inline-flex max-w-full flex-wrap items-baseline gap-x-1 gap-y-0.5 text-base font-semibold tabular-nums leading-snug sm:text-lg">
              <span className="min-w-0 break-all">{accountNumber}</span>
              <InlineCopyIconButton
                aria-label="Copy account number to clipboard"
                disabled={!accountNumber}
                onClick={() => void copyAccountNumber()}
              />
            </span>
          </div>
        </div>

        {paymentQrSrc ? (
          <div className="border-border/60 bg-card flex min-w-0 items-center justify-center overflow-hidden rounded-xl border p-2 shadow-sm sm:p-3">
            <img
              src={paymentQrSrc}
              alt={paymentQrAltText(paymentProvider)}
              className="h-auto max-h-[min(70dvh,28rem)] w-full object-contain"
              width={320}
              height={480}
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  form: UseFormReturn<GuestFormData>;
  estimatedStayPhp?: number | null;
  voucherDiscountPhp?: number;
  voucherLabel?: string | null;
};

function nightLabel(count: number): string {
  return `${count} night${count !== 1 ? 's' : ''}`;
}

export function GuestFormPaymentStepContent({
  form,
  estimatedStayPhp,
  voucherDiscountPhp = 0,
  voucherLabel,
}: Props) {
  const { data: paymentInfo } = useGuestPaymentInfo();
  const checkInDate = form.watch('checkInDate');
  const checkOutDate = form.watch('checkOutDate');

  const propertyDownPayment = paymentInfo?.downPayment;
  const breakdown = useMemo(
    () => computeGuestFormPaymentBreakdown({ checkInDate, checkOutDate }, propertyDownPayment),
    [checkInDate, checkOutDate, propertyDownPayment]
  );

  const paymentMethods = paymentInfo?.paymentMethods?.length
    ? paymentInfo.paymentMethods
    : paymentInfo?.gcashName || paymentInfo?.gcashNumber
      ? [
          {
            id: 'legacy',
            provider: paymentInfo?.paymentProvider ?? DEFAULT_PAYMENT_PROVIDER,
            accountName: paymentInfo?.gcashName ?? '',
            accountNumber: paymentInfo?.gcashNumber ?? '',
            qrImageUrl: guestFacingQrUrl(paymentInfo?.gcashQrImageUrl),
            isPrimary: true,
          },
        ]
      : [];
  const orderedMethods = [
    ...paymentMethods.filter((m) => m.isPrimary),
    ...paymentMethods.filter((m) => !m.isPrimary),
  ];

  return (
    <div className="space-y-4">
      <div
        className="border-primary/15 bg-primary/5 space-y-3 rounded-xl border px-4 py-3 text-sm"
        role="group"
        aria-label="Payment breakdown"
      >
        <p className="text-foreground font-semibold">Payment breakdown</p>
        <dl className="text-muted-foreground space-y-2">
          <div className="flex items-start justify-between gap-3">
            <dt>
              Downpayment
              <span className="mt-0.5 block text-xs">{nightLabel(breakdown.stayNights)} stay</span>
            </dt>
            <dd className="text-foreground shrink-0 font-medium tabular-nums">
              {formatMoney(breakdown.downPayment)}
            </dd>
          </div>
          {estimatedStayPhp != null && voucherLabel && voucherDiscountPhp > 0 ? (
            <div className="border-primary/15 space-y-1 border-t pt-2">
              <div className="flex justify-between gap-3">
                <dt>Estimated stay</dt>
                <dd className="tabular-nums">{formatMoney(estimatedStayPhp)}</dd>
              </div>
              <div className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-300">
                <dt>{voucherLabel}</dt>
                <dd className="tabular-nums">−{formatMoney(voucherDiscountPhp)}</dd>
              </div>
            </div>
          ) : null}
          <div className="border-primary/15 flex items-center justify-between gap-3 border-t pt-2">
            <dt className="text-foreground font-semibold">Total due now</dt>
            <dd className="text-primary text-base font-bold tabular-nums tracking-tight sm:text-lg">
              {formatMoney(breakdown.total)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4">
        {orderedMethods.length > 0
          ? orderedMethods.map((method) => <PaymentMethodCard key={method.id} method={method} />)
          : null}
      </div>
    </div>
  );
}
