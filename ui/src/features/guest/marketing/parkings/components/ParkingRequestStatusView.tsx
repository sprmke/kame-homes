import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Loader2, Mail, MessageCircle, Phone, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { ParkingChatSheet } from '@/features/guest/marketing/parkings/components/ParkingChatSheet';
import { useCancelParkingBooking } from '@/features/guest/marketing/parkings/hooks/useCancelParkingBooking';
import { useCreateParkingPaymentCheckout } from '@/features/guest/marketing/parkings/hooks/useCreateParkingPaymentCheckout';
import type { ParkingBookingStatusValue } from '@/features/guest/marketing/parkings/hooks/useParkingBookingStatus';
import { useRequestParkingEndorsement } from '@/features/guest/marketing/parkings/hooks/useRequestParkingEndorsement';

import {
  PARKING_STATUS_FLOW_STEPS,
  ParkingFlowStepper,
  parkingStatusFlowIndex,
} from '@/components/parking/ParkingFlowStepper';
import { ParkingHostSearchVisual } from '@/components/parking/ParkingHostSearchVisual';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { parkingStatusGuest } from '@/lib/parking/parkingFlowCopy';
import { parkingFlowFadeUp, parkingFlowTransition } from '@/lib/parking/parkingFlowMotion';
import { sanitizeEmailSnapshotHtml } from '@/lib/sanitizeHtml';
import { cn } from '@/lib/utils';

type HostContact = { name: string; email: string; phone: string | null };

type StatusData = {
  status: ParkingBookingStatusValue;
  checkInDate: string;
  checkOutDate: string;
  expiresAt: string | null;
  batchNumber: number;
  parkingLabel: string | null;
  parkingSlug: string | null;
  endorsementNote: string | null;
  organizationName: string | null;
  endorsementSentAt: string | null;
  endorsementSendError: string | null;
  endorsementEmailSnapshot: string | null;
  hostContact: HostContact | null;
  supportEscalationPhone: string | null;
};

type CountdownState = {
  display: string | null;
  minutesLabel: string | null;
  remainingMs: number;
};

type Props = {
  bookingId: string;
  data: StatusData;
  countdown: CountdownState;
  isRefetching?: boolean;
};

const CANCELLABLE_STATUSES: ReadonlySet<ParkingBookingStatusValue> = new Set([
  'PENDING_HOST_ACCEPTANCE',
  'PENDING_PAYMENT',
]);

const POST_PAYMENT_STATUSES: ReadonlySet<ParkingBookingStatusValue> = new Set([
  'PENDING_REVIEW',
  'READY_FOR_CHECKIN',
  'COMPLETED',
]);

function DrainBar({ expiresAt }: { expiresAt: string }) {
  const durationMs = useMemo(
    () => Math.max(1000, new Date(expiresAt).getTime() - Date.now()),
    [expiresAt]
  );
  const [drained, setDrained] = useState(false);

  useEffect(() => {
    setDrained(false);
    const raf = requestAnimationFrame(() => setDrained(true));
    return () => cancelAnimationFrame(raf);
  }, [expiresAt]);

  return (
    <div className="bg-muted h-1 w-full overflow-hidden rounded-full" aria-hidden>
      <div
        className="bg-primary h-full rounded-full transition-[width] ease-linear motion-reduce:transition-none"
        style={{ width: drained ? '0%' : '100%', transitionDuration: `${durationMs}ms` }}
      />
    </div>
  );
}

function DetailsFold({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-border/60 border-t pt-3">
      <button
        type="button"
        className="text-foreground flex min-h-[44px] w-full items-center justify-between gap-2 text-left text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 shrink-0 transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="space-y-3 pb-1 pt-2">{children}</div> : null}
    </div>
  );
}

function CancelRequestButton({
  status,
  busy,
  onConfirm,
}: {
  status: ParkingBookingStatusValue;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="text-muted-foreground min-h-[44px] w-full"
          disabled={busy}
        >
          Cancel request
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
          <AlertDialogDescription>
            {status === 'PENDING_PAYMENT'
              ? 'The host’s hold will be released and this request cancelled.'
              : 'This stops the search for a host.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep waiting</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cancel request</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ParkingRequestStatusView({ bookingId, data, countdown, isRefetching }: Props) {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const createCheckout = useCreateParkingPaymentCheckout();
  const cancelBooking = useCancelParkingBooking();
  const requestEndorsement = useRequestParkingEndorsement(bookingId);
  const [showEndorsementCopy, setShowEndorsementCopy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const meta = parkingStatusGuest(data.status);
  const isSearching = data.status === 'PENDING_HOST_ACCEPTANCE';
  const isPayment = data.status === 'PENDING_PAYMENT';
  const isWaiting = isSearching || isPayment;
  const showCountdown = isWaiting && countdown.display && countdown.remainingMs > 0;
  const canCancel = CANCELLABLE_STATUSES.has(data.status);
  const isPaid = POST_PAYMENT_STATUSES.has(data.status);
  const isTerminal = data.status === 'CANCELLED' || data.status === 'NO_HOST_AVAILABLE';
  const endorsementPending = isPaid && !data.endorsementSentAt;
  const endorsementSent = isPaid && Boolean(data.endorsementSentAt);
  const showSupport =
    Boolean(data.supportEscalationPhone) && (isPaid || isTerminal || endorsementPending);
  const showFlowStepper = isWaiting || isPaid;

  const handleRequestEndorsement = () => {
    requestEndorsement.mutate(undefined, {
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Could not send endorsement');
      },
    });
  };

  const handlePayNow = () => {
    createCheckout.mutate(bookingId, {
      onSuccess: ({ checkoutUrl }) => {
        window.location.assign(checkoutUrl);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Could not start payment');
      },
    });
  };

  const handleCancel = () => {
    cancelBooking.mutate(bookingId, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['parking-booking-status', bookingId] });
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Could not cancel request');
      },
    });
  };

  return (
    <motion.div
      initial={reduceMotion ? false : parkingFlowFadeUp.initial}
      animate={parkingFlowFadeUp.animate}
      transition={parkingFlowTransition(reduceMotion)}
      className="space-y-5"
      aria-live="polite"
    >
      {showFlowStepper ? (
        <ParkingFlowStepper
          steps={PARKING_STATUS_FLOW_STEPS}
          activeIndex={parkingStatusFlowIndex(data.status)}
        />
      ) : null}

      {(meta.detail || isRefetching) && (
        <div className="flex items-start gap-2">
          {meta.detail ? (
            <p className="text-muted-foreground text-sm leading-relaxed">{meta.detail}</p>
          ) : null}
          {isRefetching ? (
            <Loader2
              className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin"
              aria-hidden
            />
          ) : null}
        </div>
      )}

      {isSearching ? (
        <ParkingHostSearchVisual
          label={data.batchNumber > 1 ? 'Checking more hosts nearby' : 'Searching for hosts nearby'}
        />
      ) : null}

      <AnimatePresence initial={false}>
        {showCountdown ? (
          <motion.div
            key={`countdown-${data.status}-${data.expiresAt}`}
            initial={reduceMotion ? false : parkingFlowFadeUp.initial}
            animate={parkingFlowFadeUp.animate}
            exit={reduceMotion ? undefined : parkingFlowFadeUp.exit}
            transition={parkingFlowTransition(reduceMotion, 0.25)}
            className="space-y-2"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs font-medium">
                {isPayment ? 'Pay within' : 'Updates within'}
              </p>
              <p
                className="text-foreground font-mono text-sm font-semibold tabular-nums"
                aria-live="polite"
              >
                {countdown.display}
                <span className="sr-only">{countdown.minutesLabel}</span>
              </p>
            </div>
            {data.expiresAt ? <DrainBar expiresAt={data.expiresAt} /> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {data.parkingLabel && (isPayment || isPaid) ? (
        <p className="text-foreground text-sm font-medium">{data.parkingLabel}</p>
      ) : null}

      {data.endorsementNote && isPaid ? (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">Access</p>
          <p className="text-foreground text-sm leading-relaxed">{data.endorsementNote}</p>
        </div>
      ) : null}

      {endorsementPending && data.endorsementSendError ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">Endorsement didn’t send.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] shrink-0"
            onClick={handleRequestEndorsement}
            disabled={requestEndorsement.isPending}
          >
            {requestEndorsement.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            )}
            Retry
          </Button>
        </div>
      ) : null}

      {endorsementSent ? (
        <DetailsFold title="Host & endorsement">
          <div className="space-y-3">
            {data.hostContact ? (
              <div className="space-y-1.5">
                <p className="text-foreground text-sm font-semibold">{data.hostContact.name}</p>
                <a
                  href={`mailto:${data.hostContact.email}`}
                  className="text-muted-foreground flex items-center gap-2 text-sm hover:underline"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {data.hostContact.email}
                </a>
                {data.hostContact.phone ? (
                  <a
                    href={`tel:${data.hostContact.phone}`}
                    className="text-muted-foreground flex items-center gap-2 text-sm hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {data.hostContact.phone}
                  </a>
                ) : null}
              </div>
            ) : null}
            {data.endorsementEmailSnapshot ? (
              <button
                type="button"
                className="text-primary text-xs font-medium underline-offset-2 hover:underline"
                onClick={() => setShowEndorsementCopy((value) => !value)}
              >
                {showEndorsementCopy ? 'Hide endorsement copy' : 'View endorsement copy'}
              </button>
            ) : null}
            {showEndorsementCopy && data.endorsementEmailSnapshot ? (
              <div
                className="border-border bg-muted/30 max-h-48 overflow-y-auto rounded-lg border p-3 text-left text-sm [&_*]:max-w-full"
                dangerouslySetInnerHTML={{
                  __html: sanitizeEmailSnapshotHtml(data.endorsementEmailSnapshot),
                }}
              />
            ) : null}
            {data.parkingSlug ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                onClick={() => setChatOpen(true)}
              >
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                Chat with host
              </Button>
            ) : null}
          </div>
        </DetailsFold>
      ) : null}

      {isPayment ? (
        <p className="text-muted-foreground text-xs">Non-refundable once paid.</p>
      ) : null}

      {showSupport ? (
        <p className="text-muted-foreground text-xs">
          Help{' '}
          <a href={`tel:${data.supportEscalationPhone}`} className="hover:underline">
            {data.supportEscalationPhone}
          </a>
        </p>
      ) : null}

      <div className="border-border/60 flex flex-col gap-2 border-t pt-4">
        {isPayment ? (
          <>
            <Button
              className="min-h-[44px] w-full"
              onClick={handlePayNow}
              disabled={createCheckout.isPending}
            >
              {createCheckout.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Wallet className="mr-2 h-4 w-4" aria-hidden />
              )}
              Pay now
            </Button>
            {canCancel ? (
              <CancelRequestButton
                status={data.status}
                busy={cancelBooking.isPending}
                onConfirm={handleCancel}
              />
            ) : null}
          </>
        ) : isSearching ? (
          canCancel ? (
            <CancelRequestButton
              status={data.status}
              busy={cancelBooking.isPending}
              onConfirm={handleCancel}
            />
          ) : null
        ) : (
          <Button asChild variant={isPaid ? 'outline' : 'default'} className="min-h-[44px] w-full">
            <Link to="/parkings">Browse parking</Link>
          </Button>
        )}
      </div>

      {data.parkingSlug ? (
        <ParkingChatSheet
          open={chatOpen}
          onOpenChange={setChatOpen}
          parkingSlug={data.parkingSlug}
          parkingLabel={data.parkingLabel ?? 'Parking'}
          hostName={data.hostContact?.name ?? ''}
          checkInDate={data.checkInDate}
          checkOutDate={data.checkOutDate}
        />
      ) : null}
    </motion.div>
  );
}
