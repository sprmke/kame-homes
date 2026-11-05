import { useEffect, useState, type ReactNode } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { captureGuestBookingAccessFromSearchParams } from '@/features/guest/form/lib/guestBookingAccess';
import { pickGuestBrandHeaderProps } from '@/features/guest/form/lib/guestFormBranding';
import { useGuestPropertySlug } from '@/features/guest/hooks/useGuestPropertySlug';
import { isGuestEmbedPreview } from '@/features/guest/lib/guestEmbedPreview';
import { guestTripPath } from '@/features/guest/lib/guestPublicPaths';
import { GuestReviewEmbedPreview } from '@/features/guest/sd-form/components/GuestReviewEmbedPreview';
import { SdFormReviewSection } from '@/features/guest/sd-form/components/SdFormReviewSection';
import { VoucherReveal } from '@/features/guest/sd-form/components/VoucherReveal';
import {
  claimSdVoucher,
  fetchGuestReview,
  type GuestReviewBootstrap,
} from '@/features/guest/sd-form/lib/api';
import { findVoucher, prizesToVouchers, type Voucher } from '@/features/guest/sd-form/lib/voucher';
import { normalizeVoucherRevealStyle } from '@/features/guest/sd-form/lib/voucherRevealStyle';
import { GuestTripBackLink } from '@/features/guest/trip/components/GuestTripBackLink';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';
import { useAntiSpamSubmit } from '@/components/security/useAntiSpamSubmit';
import { GuestReviewPageSkeleton } from '@/components/skeletons/GuestPageSkeletons';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Phase = 'review' | 'voucher' | 'done';

const GUEST_REVIEW_BRAND_TITLE = 'Guest Review';

export function GuestReviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = (searchParams.get('bookingId') ?? '').trim();
  const propertySlug = useGuestPropertySlug();
  const embedPreview = isGuestEmbedPreview(searchParams);

  useEffect(() => {
    if (bookingId) captureGuestBookingAccessFromSearchParams(bookingId, searchParams);
  }, [bookingId, searchParams]);

  const { data: guestBrand = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
  const brandHeader = pickGuestBrandHeaderProps(guestBrand);
  const [phase, setPhase] = useState<Phase>('review');

  const query = useQuery({
    queryKey: ['guest-review', bookingId],
    queryFn: () => fetchGuestReview(bookingId),
    enabled: Boolean(bookingId),
    retry: false,
  });

  const existingVoucher = query.data?.next_stay_voucher_code
    ? findVoucher(query.data.next_stay_voucher_code, query.data.next_stay_voucher_amount)
    : null;

  const claimAntiSpam = useAntiSpamSubmit({ action: 'claim-sd-voucher' });

  const claimMut = useMutation({
    mutationFn: async (): Promise<Voucher> => {
      const fields = await claimAntiSpam.collect();
      try {
        const res = await claimSdVoucher(bookingId, fields);
        const v = findVoucher(res.code, res.amount);
        if (!v) throw new Error('Received an unknown voucher code from the server.');
        return v;
      } finally {
        claimAntiSpam.reset();
      }
    },
    onError: (err: Error) => {
      toast.error(friendlyToastError(err, 'Could not reveal your voucher'));
    },
  });

  useEffect(() => {
    if (phase !== 'review' || !query.data) return;
    if (existingVoucher) {
      setPhase('voucher');
      return;
    }
    if (!query.data.guest_review_submitted || query.data.can_edit_review !== false) return;
    setPhase(query.data.vouchers_enabled === false ? 'done' : 'voucher');
  }, [existingVoucher, query.data, phase]);

  if (embedPreview && !bookingId) {
    return <GuestReviewEmbedPreview />;
  }

  if (!bookingId) {
    return (
      <div className="guest-inner-enter mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-muted-foreground text-sm">Missing booking link.</p>
      </div>
    );
  }

  if (query.isLoading) {
    return <GuestReviewPageSkeleton title={GUEST_REVIEW_BRAND_TITLE} />;
  }

  if (query.isError || !query.data) {
    return (
      <div className="guest-inner-enter mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <p className="text-foreground text-base font-semibold">Review unavailable</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {query.error instanceof Error ? query.error.message : 'This link is not valid.'}
        </p>
      </div>
    );
  }

  return (
    <GuestReviewContent
      bookingId={bookingId}
      data={query.data}
      phase={phase}
      brandHeader={brandHeader}
      existingVoucher={existingVoucher}
      isClaiming={claimMut.isPending}
      onClaim={() => claimMut.mutateAsync()}
      claimWidget={claimAntiSpam.render}
      onReviewSubmitted={() => setPhase(query.data.vouchers_enabled === false ? 'done' : 'voucher')}
      onSkip={() => {
        if (propertySlug) {
          navigate(guestTripPath(propertySlug, bookingId));
          return;
        }
        setPhase(query.data.vouchers_enabled === false ? 'done' : 'voucher');
      }}
      onVoucherDone={() => setPhase('done')}
    />
  );
}

function GuestReviewContent({
  bookingId,
  data,
  phase,
  brandHeader,
  existingVoucher,
  isClaiming,
  onClaim,
  claimWidget,
  onReviewSubmitted,
  onSkip,
  onVoucherDone,
}: {
  bookingId: string;
  data: GuestReviewBootstrap;
  phase: Phase;
  brandHeader: ReturnType<typeof pickGuestBrandHeaderProps>;
  existingVoucher: Voucher | null;
  isClaiming: boolean;
  onClaim: () => Promise<Voucher>;
  claimWidget: ReactNode;
  onReviewSubmitted: () => void;
  onSkip: () => void;
  onVoucherDone: () => void;
}) {
  return (
    <div className="guest-inner-enter relative mx-auto w-full max-w-xl space-y-6 p-4 sm:p-6 lg:p-8">
      <GuestTripBackLink bookingId={bookingId} className="-mb-4" />
      <GuestFormBrandHeader {...brandHeader} title={GUEST_REVIEW_BRAND_TITLE} />

      {phase === 'review' ? (
        <>
          <header className="space-y-3 px-1 text-center sm:px-2">
            <p className="text-muted-foreground text-sm leading-relaxed">
              How was your stay? You can skip this.
            </p>
          </header>
          <SdFormReviewSection
            bookingId={bookingId}
            awaitingBalanceSettlement={false}
            onReviewSubmitted={onReviewSubmitted}
            reviewDraft={data.review_draft}
            canEdit={data.can_edit_review !== false}
            onSkip={onSkip}
          />
        </>
      ) : null}

      {phase === 'voucher' ? (
        <VoucherReveal
          existingVoucher={existingVoucher}
          isClaiming={isClaiming}
          onClaim={onClaim}
          onContinue={onVoucherDone}
          continueLabel="Done"
          primaryGuestName={data.primary_guest_name}
          checkInDate={data.check_in_date}
          checkOutDate={data.check_out_date}
          prizePool={
            data.voucher_prizes?.length ? prizesToVouchers(data.voucher_prizes) : undefined
          }
          style={normalizeVoucherRevealStyle(data.voucher_reveal_style)}
        />
      ) : null}

      {phase === 'voucher' ? claimWidget : null}

      {phase === 'done' ? (
        <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-3 rounded-xl border px-4 py-10 text-center">
          <span className="bg-primary/15 text-primary flex size-12 items-center justify-center rounded-full">
            <Check className="size-6" aria-hidden />
          </span>
          <p className="text-foreground text-sm font-semibold">Thanks for your review</p>
        </div>
      ) : null}
    </div>
  );
}
