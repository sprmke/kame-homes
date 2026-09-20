import { useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams, Link } from 'react-router-dom';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Check, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { GuestFormStepper } from '@/features/guest/form/components/GuestFormStepper';
import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { captureGuestBookingAccessFromSearchParams } from '@/features/guest/form/lib/guestBookingAccess';
import {
  formatGuestFarewell,
  formatGuestStayThanks,
  pickGuestBrandHeaderProps,
} from '@/features/guest/form/lib/guestFormBranding';
import { isGuestEmbedPreview } from '@/features/guest/lib/guestEmbedPreview';
import { SdFormEmbedPreview } from '@/features/guest/sd-form/components/SdFormEmbedPreview';
import { SdFormReviewSection } from '@/features/guest/sd-form/components/SdFormReviewSection';
import { VoucherReveal } from '@/features/guest/sd-form/components/VoucherReveal';
import {
  claimSdVoucher,
  fetchSdForm,
  submitSdForm,
  type SdFormBootstrap,
} from '@/features/guest/sd-form/lib/api';
import type { SubmitSdRefundBody } from '@/features/guest/sd-form/lib/api';
import {
  SD_BANKS,
  refundBodySchema,
  sdFormSubmitSchema,
  type RefundBodyValues,
  type SdBank,
} from '@/features/guest/sd-form/lib/sdFormSchema';
import { SD_FORM_STEPS } from '@/features/guest/sd-form/lib/sdFormSteps';
import {
  findVoucher,
  formatVoucherDiscountMaxLabel,
  prizesToVouchers,
  type Voucher,
} from '@/features/guest/sd-form/lib/voucher';
import { normalizeVoucherRevealStyle } from '@/features/guest/sd-form/lib/voucherRevealStyle';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';
import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { ContextualActionBar } from '@/components/mobile/ContextualActionBar';
import { useAntiSpamSubmit } from '@/components/security/useAntiSpamSubmit';
import { SdFormPageSkeleton } from '@/components/skeletons/GuestPageSkeletons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';
import { toCapitalCase } from '@/utils/text/formatters';
import { handleNameInputChange } from '@/utils/text/helpers';

type Step = 1 | 2 | 3 | 'done';

/** Step 2 sub-phases: balance wait after review, then voucher raffle reveal. */
type Step2Phase = 'wait_balance' | 'voucher';

const SD_FORM_BRAND_TITLE = 'SD Refund Form';

export function SdFormPage() {
  const [searchParams] = useSearchParams();
  const bookingId = (searchParams.get('bookingId') ?? '').trim();
  const embedPreview = isGuestEmbedPreview(searchParams);

  useEffect(() => {
    if (bookingId) captureGuestBookingAccessFromSearchParams(bookingId, searchParams);
  }, [bookingId, searchParams]);
  const { data: guestBrand = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
  const brandHeader = pickGuestBrandHeaderProps(guestBrand);

  const [step, setStep] = useState<Step>(1);
  const [step2Phase, setStep2Phase] = useState<Step2Phase>('voucher');

  const [method, setMethod] = useState<RefundBodyValues['method']>('same_phone');
  const [bank, setBank] = useState<string>(SD_BANKS[0]);
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Invisible anti-spam — a widget per protected action (Turnstile `action`
  // must match the server `scope`). Plan: docs/workflow/for-testing/captcha-anti-spam-hardening.md
  const claimAntiSpam = useAntiSpamSubmit({ action: 'claim-sd-voucher' });
  const submitAntiSpam = useAntiSpamSubmit({ action: 'submit-sd-form' });

  const query = useQuery({
    queryKey: ['sd-form', bookingId],
    queryFn: () => fetchSdForm(bookingId),
    enabled: bookingId.length > 0,
    retry: false,
    refetchInterval: (q) => (q.state.data?.awaiting_balance_settlement === true ? 8000 : false),
  });

  const sdFormOpenedRef = useRef(false);
  useEffect(() => {
    if (!query.data || sdFormOpenedRef.current) return;
    sdFormOpenedRef.current = true;
    captureAppEvent('sd_form_opened', {
      had_voucher_reveal: Boolean(query.data.next_stay_voucher_code),
      booking_id: bookingId,
    });
  }, [query.data, bookingId]);

  const existingVoucher = query.data?.next_stay_voucher_code
    ? findVoucher(query.data.next_stay_voucher_code, query.data.next_stay_voucher_amount)
    : null;

  // Returning guests: skip review when already submitted or voucher exists.
  useEffect(() => {
    if (step !== 1 || !query.data) return;
    const vouchersEnabled = query.data.vouchers_enabled !== false;
    if (existingVoucher) {
      setStep(2);
      setStep2Phase('voucher');
      return;
    }
    if (!query.data.guest_review_submitted) return;
    if (query.data.awaiting_balance_settlement) {
      setStep(2);
      setStep2Phase('wait_balance');
      return;
    }
    if (vouchersEnabled) {
      setStep(2);
      setStep2Phase('voucher');
    } else {
      setStep(3);
    }
  }, [existingVoucher, query.data, step]);

  useEffect(() => {
    const d = query.data;
    if (!d?.awaiting_balance_settlement && step2Phase === 'wait_balance') {
      if (d?.vouchers_enabled === false && !d.next_stay_voucher_code) {
        setStep(3);
      } else {
        setStep2Phase('voucher');
      }
    }
  }, [query.data, step2Phase]);

  useEffect(() => {
    if (query.data?.awaiting_balance_settlement && step2Phase === 'voucher' && step === 2) {
      setStep2Phase('wait_balance');
    }
  }, [query.data?.awaiting_balance_settlement, step2Phase, step]);

  const claimMut = useMutation({
    mutationFn: async (): Promise<Voucher> => {
      const fields = await claimAntiSpam.collect();
      try {
        const res = await claimSdVoucher(bookingId, fields);
        const v = findVoucher(res.code, res.amount);
        if (!v) {
          throw new Error('Received an unknown voucher code from the server.');
        }
        return v;
      } finally {
        claimAntiSpam.reset();
      }
    },
    onError: (err: Error) => {
      toast.error(friendlyToastError(err, 'Could not reveal your voucher'));
    },
  });

  const submitMut = useMutation({
    mutationFn: async (data: SdFormBootstrap) => {
      const refund =
        method === 'same_phone'
          ? { method: 'same_phone' as const }
          : method === 'other_bank'
            ? {
                method: 'other_bank' as const,
                bank: bank as SdBank,
                accountName,
                accountNumber,
              }
            : { method: 'cash' as const };
      const parsed = sdFormSubmitSchema.safeParse({ refund });
      if (!parsed.success) {
        const fe = parsed.error.flatten().fieldErrors;
        const msg =
          fe.refund?.[0] ??
          parsed.error.errors[0]?.message ??
          'Please check the form and try again';
        throw new Error(msg);
      }
      const r = parsed.data.refund;
      const refundBody: SubmitSdRefundBody['refund'] =
        r.method === 'same_phone'
          ? { method: 'same_phone' }
          : r.method === 'other_bank'
            ? {
                method: 'other_bank',
                bank: r.bank,
                accountName: r.accountName,
                accountNumber: r.accountNumber,
              }
            : { method: 'cash' };
      const fields = await submitAntiSpam.collect();
      try {
        await submitSdForm(
          {
            bookingId: data.bookingId,
            refund: refundBody,
          },
          fields
        );
      } finally {
        submitAntiSpam.reset();
      }
    },
    onSuccess: () => {
      setStep('done');
      toast.success('Refund details received');
    },
    onError: (err: Error) => {
      toast.error(friendlyToastError(err, 'Could not submit'));
    },
  });

  if (embedPreview && !bookingId) {
    return <SdFormEmbedPreview />;
  }

  if (!bookingId) {
    return (
      <div className="relative space-y-6 p-4 text-center sm:p-6 lg:p-8">
        <div className="space-y-3">
          <h1 className="text-foreground text-base font-bold">Missing booking link</h1>
          <p className="text-muted-foreground text-sm">
            Use the link from your email, or contact your host for help.
          </p>
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (query.isLoading) {
    return <SdFormPageSkeleton title={SD_FORM_BRAND_TITLE} />;
  }

  if (query.isError || !query.data) {
    return (
      <div className="relative space-y-6 p-4 text-center sm:p-6 lg:p-8">
        <div className="space-y-3">
          <h1 className="text-foreground text-base font-bold">Form not available</h1>
          <p className="text-muted-foreground text-sm">
            {(query.error as Error)?.message ??
              "This form isn't available. Use your email link or contact your host for help."}
          </p>
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const data = query.data;

  if (step === 'done') {
    return (
      <div className="relative space-y-6 p-4 text-center sm:p-6 lg:p-8">
        <div className="mx-auto flex max-w-md flex-col items-center gap-5">
          <div className="bg-primary/15 text-primary flex size-14 shrink-0 items-center justify-center rounded-full">
            <Check className="size-7" strokeWidth={2.5} aria-hidden />
          </div>
          <div className="space-y-3 px-3 sm:px-0">
            <h1 className="text-foreground text-base font-bold sm:text-lg">You&apos;re all set!</h1>
            <p className="text-muted-foreground leading-relaxed">
              Thanks, <strong>{data.primary_guest_name}</strong>! We&apos;ll process your SD refund
              in 1–2 hours using your details.
            </p>
            <p className="strong text-muted-foreground leading-relaxed">
              {formatGuestFarewell(guestBrand.organizationName)}
            </p>
          </div>
          <Button asChild className="min-h-[44px] w-full min-w-[44px] sm:w-auto">
            <Link to="/">Check next available dates</Link>
          </Button>
        </div>
      </div>
    );
  }

  const showGreeting = step === 1;

  const stepperActive: 1 | 2 | 3 = step === 1 ? 1 : step === 2 ? 2 : 3;
  /* Step 3's bank-details form floats its Back/Submit on phone/tablet — clear it here. */
  const showsFloatingActions = step === 3 && !data.awaiting_balance_settlement;

  return (
    <div
      className={cn(
        'relative space-y-6 p-4 sm:p-6 lg:p-8',
        showsFloatingActions && bottomTabBarOffsetClassName()
      )}
    >
      <GuestFormBrandHeader {...brandHeader} title={SD_FORM_BRAND_TITLE} />
      <GuestFormStepper activeStep={stepperActive} steps={SD_FORM_STEPS} />

      {showGreeting && (
        <header className="border-separator space-y-4 border-b px-5 pb-5">
          <h1 className="text-foreground text-base font-bold sm:text-lg">
            Hi {data.primary_guest_name},
          </h1>
          <div className="text-muted-foreground space-y-3 text-base leading-relaxed">
            <p>{formatGuestStayThanks(guestBrand.organizationName)}</p>
            <p>
              Before your SD refund, leave a quick review and share favorite moments from your stay.
            </p>
          </div>
          <div className="to-primary/5 dark:to-primary/10 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-amber-50/50 px-4 py-3.5 dark:border-amber-500/25 dark:from-amber-500/10 dark:via-amber-500/5">
            <p className="text-sm font-semibold leading-snug text-amber-950 dark:text-amber-100">
              Review us for a chance to win {formatVoucherDiscountMaxLabel()} or a FREE stay on your
              next booking!
            </p>
          </div>
        </header>
      )}

      {step === 1 && (
        <div className="px-5 sm:px-6">
          <SdFormReviewSection
            bookingId={bookingId}
            awaitingBalanceSettlement={Boolean(data.awaiting_balance_settlement)}
            onReviewSubmitted={() => {
              if (data.awaiting_balance_settlement) {
                setStep(2);
                setStep2Phase('wait_balance');
              } else if (data.vouchers_enabled !== false) {
                setStep(2);
                setStep2Phase('voucher');
              } else {
                setStep(3);
              }
            }}
          />
        </div>
      )}

      {step === 2 && step2Phase === 'wait_balance' && (
        <div className="border-border/60 bg-muted/20 mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border px-4 py-8 text-center sm:px-6">
          <Loader2 className="text-primary size-9 animate-spin" aria-hidden />
          <div className="space-y-2">
            <p className="text-foreground text-sm font-semibold">Almost there</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We emailed check-out details. Recording your balance—this page updates when your
              surprise bonus opens.
            </p>
          </div>
        </div>
      )}

      {step === 2 && step2Phase === 'voucher' && !data.awaiting_balance_settlement && (
        <>
          <VoucherReveal
            existingVoucher={existingVoucher}
            isClaiming={claimMut.isPending}
            onClaim={() => claimMut.mutateAsync()}
            onContinue={() => setStep(3)}
            primaryGuestName={data.primary_guest_name}
            checkInDate={data.check_in_date}
            checkOutDate={data.check_out_date}
            prizePool={
              data.voucher_prizes?.length ? prizesToVouchers(data.voucher_prizes) : undefined
            }
            style={normalizeVoucherRevealStyle(data.voucher_reveal_style)}
          />
          {claimAntiSpam.render}
        </>
      )}

      {step === 3 && data.awaiting_balance_settlement && (
        <div className="border-border/60 bg-muted/20 mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border px-4 py-8 text-center sm:px-6">
          <Loader2 className="text-primary size-9 animate-spin" aria-hidden />
          <p className="text-muted-foreground text-sm leading-relaxed">
            Refund details unlock when your stay moves to check-out. This page will update shortly.
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setStep(2)}
          >
            Back
          </Button>
        </div>
      )}

      {step === 3 && !data.awaiting_balance_settlement && (
        <>
          <StepTwo
            data={data}
            method={method}
            onMethodChange={setMethod}
            bank={bank}
            onBankChange={setBank}
            accountName={accountName}
            onAccountNameChange={setAccountName}
            accountNumber={accountNumber}
            onAccountNumberChange={setAccountNumber}
            onBack={() => setStep(2)}
            onSubmit={() => submitMut.mutate(data)}
            isSubmitting={submitMut.isPending}
          />
          {submitAntiSpam.render}
        </>
      )}
    </div>
  );
}

function MethodCard({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  /** Omit for a single-line option (title only). */
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'min-h-[44px] w-full rounded-xl border px-3 py-3 text-left transition-colors sm:min-h-0',
        selected
          ? 'border-primary bg-primary/5 border-2'
          : 'border-border bg-card hover:bg-muted/40 border'
      )}
    >
      <p className="text-foreground text-sm font-semibold">{title}</p>
      {description ? (
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{description}</p>
      ) : null}
    </button>
  );
}

function StepTwo({
  data,
  method,
  onMethodChange,
  bank,
  onBankChange,
  accountName,
  onAccountNameChange,
  accountNumber,
  onAccountNumberChange,
  onBack,
  onSubmit,
  isSubmitting,
}: {
  data: SdFormBootstrap;
  method: RefundBodyValues['method'];
  onMethodChange: (m: RefundBodyValues['method']) => void;
  bank: string;
  onBankChange: (v: string) => void;
  accountName: string;
  onAccountNameChange: (v: string) => void;
  accountNumber: string;
  onAccountNumberChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const [otherBankFieldTouch, setOtherBankFieldTouch] = useState({
    bank: false,
    accountName: false,
    accountNumber: false,
  });

  useEffect(() => {
    if (method !== 'other_bank') {
      setOtherBankFieldTouch({
        bank: false,
        accountName: false,
        accountNumber: false,
      });
    }
  }, [method]);

  const stepTwoValidation = useMemo(() => {
    const payload =
      method === 'same_phone'
        ? ({ method: 'same_phone' } as const)
        : method === 'cash'
          ? ({ method: 'cash' } as const)
          : ({
              method: 'other_bank' as const,
              bank: bank as SdBank,
              accountName,
              accountNumber,
            } as const);
    const r = refundBodySchema.safeParse(payload);
    if (r.success) {
      return { canSubmit: true, errors: {} as Record<string, string> };
    }
    const errors: Record<string, string> = {};
    for (const iss of r.error.issues) {
      const k = iss.path[0];
      if (typeof k === 'string' && !errors[k]) errors[k] = iss.message;
    }
    return { canSubmit: false, errors };
  }, [method, bank, accountName, accountNumber]);

  const showOtherBankFieldError = (field: keyof typeof otherBankFieldTouch) =>
    method === 'other_bank' &&
    otherBankFieldTouch[field] &&
    Boolean(stepTwoValidation.errors[field]);

  return (
    <div className="space-y-5">
      <div className="border-border/80 bg-muted/15 flex items-center gap-3 rounded-xl border px-4 py-3">
        <div className="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Wallet className="size-4" aria-hidden />
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Choose how you&apos;d like to receive your security deposit refund.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Option</p>
        <div className="flex flex-col gap-2">
          <MethodCard
            selected={method === 'same_phone'}
            onSelect={() => onMethodChange('same_phone')}
            title={`GCash - ${(data.guest_phone_number ?? '').trim() || '-'}`}
            description="Same phone number from your guest form"
          />
          <MethodCard
            selected={method === 'other_bank'}
            onSelect={() => onMethodChange('other_bank')}
            title="Another GCash or bank account"
            description="Provide different GCash or bank details"
          />
          <MethodCard
            selected={method === 'cash'}
            onSelect={() => onMethodChange('cash')}
            title="Cash pickup"
          />
        </div>
      </div>

      {method === 'other_bank' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sd-bank" className="text-sm font-medium">
              Bank / channel
            </Label>
            <Select
              value={bank}
              onValueChange={(v) => {
                setOtherBankFieldTouch((prev) => ({ ...prev, bank: true }));
                onBankChange(v);
              }}
            >
              <SelectTrigger
                id="sd-bank"
                className={cn(
                  'bg-background text-foreground font-normal',
                  showOtherBankFieldError('bank') && 'border-destructive ring-destructive/30 ring-1'
                )}
                aria-invalid={showOtherBankFieldError('bank')}
                aria-describedby={showOtherBankFieldError('bank') ? 'sd-bank-error' : undefined}
              >
                <SelectValue placeholder="Choose bank" />
              </SelectTrigger>
              <SelectContent position="popper">
                {SD_BANKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showOtherBankFieldError('bank') ? (
              <p id="sd-bank-error" className="text-destructive text-xs" role="alert">
                {stepTwoValidation.errors.bank}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-acc-name" className="text-sm font-medium">
              Account name
            </Label>
            <input
              id="sd-acc-name"
              value={accountName}
              onChange={(e) => {
                setOtherBankFieldTouch((prev) => ({
                  ...prev,
                  accountName: true,
                }));
                handleNameInputChange(e, onAccountNameChange, toCapitalCase);
              }}
              onBlur={() =>
                setOtherBankFieldTouch((prev) => ({
                  ...prev,
                  accountName: true,
                }))
              }
              className={cn(
                'bg-background h-11 w-full rounded-lg border px-3 text-sm',
                showOtherBankFieldError('accountName')
                  ? 'border-destructive ring-destructive/30 ring-1'
                  : 'border-input'
              )}
              placeholder={FORM_PLACEHOLDERS.fullName}
              autoComplete="name"
              aria-invalid={showOtherBankFieldError('accountName')}
              aria-describedby={
                showOtherBankFieldError('accountName') ? 'sd-acc-name-error' : undefined
              }
            />
            {showOtherBankFieldError('accountName') ? (
              <p id="sd-acc-name-error" className="text-destructive text-xs" role="alert">
                {stepTwoValidation.errors.accountName}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-acc-no" className="text-sm font-medium">
              Account number
            </Label>
            <input
              id="sd-acc-no"
              value={accountNumber}
              onChange={(e) => {
                setOtherBankFieldTouch((prev) => ({
                  ...prev,
                  accountNumber: true,
                }));
                onAccountNumberChange(e.target.value.replace(/\D/g, '').slice(0, 20));
              }}
              onBlur={() =>
                setOtherBankFieldTouch((prev) => ({
                  ...prev,
                  accountNumber: true,
                }))
              }
              className={cn(
                'bg-background h-11 w-full rounded-lg border px-3 font-mono text-sm',
                showOtherBankFieldError('accountNumber')
                  ? 'border-destructive ring-destructive/30 ring-1'
                  : 'border-input'
              )}
              placeholder={FORM_PLACEHOLDERS.phone}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={showOtherBankFieldError('accountNumber')}
              aria-describedby={
                showOtherBankFieldError('accountNumber') ? 'sd-acc-no-error' : undefined
              }
            />
            {showOtherBankFieldError('accountNumber') ? (
              <p id="sd-acc-no-error" className="text-destructive text-xs" role="alert">
                {stepTwoValidation.errors.accountNumber}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {method === 'cash' && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3" role="note">
          <p className="text-sm leading-relaxed text-amber-950">
            Cash refunds need on-site staff and cash payment. Message us on Facebook or Airbnb
            before leaving.
          </p>
        </div>
      )}

      <SdRefundStepTwoActions
        isSubmitting={isSubmitting}
        canSubmit={stepTwoValidation.canSubmit}
        onBack={onBack}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function SdRefundStepTwoActions({
  isSubmitting,
  canSubmit,
  onBack,
  onSubmit,
}: {
  isSubmitting: boolean;
  canSubmit: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const isBelowLg = useIsBelowLg();

  const actions = (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] w-full sm:w-auto"
        disabled={isSubmitting}
        onClick={onBack}
      >
        Back
      </Button>
      <Button
        type="button"
        className="shadow-primary/15 min-h-[44px] w-full shadow-md sm:w-auto"
        disabled={isSubmitting || !canSubmit}
        onClick={onSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Submitting…
          </>
        ) : (
          'Submit security deposit refund'
        )}
      </Button>
    </div>
  );

  if (isBelowLg) {
    return <ContextualActionBar>{actions}</ContextualActionBar>;
  }

  return actions;
}
