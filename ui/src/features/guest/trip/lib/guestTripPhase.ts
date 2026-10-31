/**
 * Guest-facing model of a booking: which phase the trip is in, the one thing to do now,
 * progress, a short checklist, and shortcuts. Pure so it can be unit-tested with a fixed
 * Manila "today". Every surface on the trip page reads from here so the pill, progress
 * bar and main button never disagree.
 */

export type GuestTripTone = 'neutral' | 'info' | 'success' | 'warning' | 'muted';

const CONFIRMED_STATUSES = new Set([
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
]);

const POST_STAY_STATUSES = new Set(['READY_FOR_CHECKOUT', 'PENDING_SD_REFUND', 'COMPLETED']);

/** Checked out or later: arrival info (rules, pending documents, balance due) no longer applies. */
export function isGuestTripPostStay(status: string): boolean {
  return POST_STAY_STATUSES.has(status.trim());
}

// ---------------------------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------------------------

export type GuestTripTiming =
  | { kind: 'upcoming'; daysUntil: number }
  | { kind: 'in_stay'; night: number; nights: number }
  | { kind: 'checkout_day' }
  | { kind: 'past' };

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToUtcMs(toYmd) - ymdToUtcMs(fromYmd)) / 86_400_000);
}

export function guestTripTiming(
  checkInYmd: string,
  checkOutYmd: string,
  todayYmd: string
): GuestTripTiming {
  if (todayYmd < checkInYmd) {
    return { kind: 'upcoming', daysUntil: daysBetween(todayYmd, checkInYmd) };
  }
  if (todayYmd === checkOutYmd) return { kind: 'checkout_day' };
  if (todayYmd > checkOutYmd) return { kind: 'past' };
  const nights = Math.max(1, daysBetween(checkInYmd, checkOutYmd));
  return { kind: 'in_stay', night: daysBetween(checkInYmd, todayYmd) + 1, nights };
}

// ---------------------------------------------------------------------------------------------
// Phase
// ---------------------------------------------------------------------------------------------

export type GuestTripPhase =
  | 'requested'
  | 'confirmed'
  | 'arriving'
  | 'arrival_day'
  | 'staying'
  | 'checkout_day'
  | 'checked_out'
  | 'refund_pending'
  | 'completed'
  | 'cancelled';

export function guestTripPhase(status: string, timing: GuestTripTiming): GuestTripPhase {
  const s = status.trim();
  if (s === 'CANCELLED') return 'cancelled';
  if (s === 'PENDING_REVIEW') return 'requested';
  if (CONFIRMED_STATUSES.has(s)) return 'confirmed';
  if (s === 'READY_FOR_CHECKOUT') return 'checked_out';
  if (s === 'PENDING_SD_REFUND') return 'refund_pending';
  if (s === 'COMPLETED') return 'completed';
  if (s === 'READY_FOR_CHECKIN') {
    switch (timing.kind) {
      case 'upcoming':
        return timing.daysUntil === 0 ? 'arrival_day' : 'arriving';
      case 'in_stay':
        // Night 1 is check-in day: arrival still matters more than "staying".
        return timing.night === 1 ? 'arrival_day' : 'staying';
      case 'checkout_day':
        return 'checkout_day';
      case 'past':
        return 'checked_out';
    }
  }
  return 'confirmed';
}

/** Before or during the stay: arrival info, payment due and documents still matter. */
export function isGuestTripActive(phase: GuestTripPhase): boolean {
  return (
    phase === 'confirmed' ||
    phase === 'arriving' ||
    phase === 'arrival_day' ||
    phase === 'staying' ||
    phase === 'checkout_day'
  );
}

// ---------------------------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------------------------

export const GUEST_TRIP_STEPS = [
  'Requested',
  'Confirmed',
  'Check-in',
  'Stay',
  'Check-out',
] as const;

/**
 * Segments completed (0–5) and the active segment (-1 when none). Completed trips fill all
 * five; cancelled trips show no progress.
 */
export function guestTripProgress(phase: GuestTripPhase): { done: number; active: number } {
  switch (phase) {
    case 'requested':
      return { done: 0, active: 0 };
    case 'confirmed':
      return { done: 1, active: 1 };
    case 'arriving':
    case 'arrival_day':
      return { done: 2, active: 2 };
    case 'staying':
    case 'checkout_day':
      return { done: 3, active: 3 };
    case 'checked_out':
    case 'refund_pending':
      return { done: 4, active: 4 };
    case 'completed':
      return { done: 5, active: -1 };
    case 'cancelled':
      return { done: 0, active: -1 };
  }
}

// ---------------------------------------------------------------------------------------------
// Headline
// ---------------------------------------------------------------------------------------------

export type GuestTripHeadline = {
  /** Short status word, also used as the pill. */
  kicker: string;
  title: string;
  body: string | null;
  tone: GuestTripTone;
};

export type GuestTripHeadlineInput = {
  phase: GuestTripPhase;
  timing: GuestTripTiming;
  /** Pre-formatted, e.g. "2:00 PM". */
  checkInTimeLabel: string | null;
  checkOutTimeLabel: string | null;
  /** Pre-formatted, e.g. "Sat, Oct 10". */
  checkInDateLabel: string;
  checkOutDateLabel: string;
  documentsPending: boolean;
  sdFormAvailable: boolean;
  /** Pre-formatted refunded amount, e.g. "₱1,600". */
  refundLabel: string | null;
  /** Pre-formatted, e.g. "Sep 18". */
  cancelledOnLabel?: string | null;
};

export function guestTripHeadline(input: GuestTripHeadlineInput): GuestTripHeadline {
  const { phase, timing } = input;
  switch (phase) {
    case 'requested':
      return {
        kicker: 'Request sent',
        title: 'Your host is reviewing your booking',
        body: "We'll email you once it's confirmed.",
        tone: 'info',
      };
    case 'confirmed':
      return {
        kicker: 'Confirmed',
        title: input.documentsPending
          ? 'Your host is preparing your check-in documents'
          : "You're confirmed",
        body: `Check-in ${input.checkInDateLabel}${input.checkInTimeLabel ? ` from ${input.checkInTimeLabel}` : ''}`,
        tone: 'info',
      };
    case 'arriving': {
      const days = timing.kind === 'upcoming' ? timing.daysUntil : 0;
      return {
        kicker: 'Ready for check-in',
        title: days === 1 ? 'Check-in is tomorrow' : `Check-in in ${days} days`,
        body: input.checkInTimeLabel
          ? `${input.checkInDateLabel}, from ${input.checkInTimeLabel}`
          : input.checkInDateLabel,
        tone: 'success',
      };
    }
    case 'arrival_day':
      return {
        kicker: 'Arriving today',
        title: input.checkInTimeLabel
          ? `Check in from ${input.checkInTimeLabel}`
          : 'Check-in is today',
        body: null,
        tone: 'success',
      };
    case 'staying':
      return {
        kicker: 'Staying',
        title:
          timing.kind === 'in_stay'
            ? `Night ${timing.night} of ${timing.nights}`
            : 'Enjoy your stay',
        body: input.checkOutTimeLabel
          ? `Check out ${input.checkOutDateLabel} by ${input.checkOutTimeLabel}`
          : `Check out ${input.checkOutDateLabel}`,
        tone: 'success',
      };
    case 'checkout_day':
      return {
        kicker: 'Check-out day',
        title: input.checkOutTimeLabel
          ? `Check out by ${input.checkOutTimeLabel}`
          : 'Check-out is today',
        body: null,
        tone: 'warning',
      };
    case 'checked_out':
      return {
        kicker: 'Checked out',
        title: input.sdFormAvailable ? 'Get your deposit back' : 'Thanks for staying',
        body: input.sdFormAvailable
          ? 'Send your refund details so your host can return your security deposit.'
          : null,
        tone: input.sdFormAvailable ? 'warning' : 'neutral',
      };
    case 'refund_pending':
      return {
        kicker: 'Refund in progress',
        title: 'Your host is processing your deposit refund',
        body: null,
        tone: 'info',
      };
    case 'completed':
      return {
        kicker: 'Completed',
        title: 'Thanks for staying',
        body: input.refundLabel ? `Deposit refunded: ${input.refundLabel}` : null,
        tone: 'neutral',
      };
    case 'cancelled':
      return {
        kicker: 'Cancelled',
        title: input.cancelledOnLabel
          ? `Cancelled on ${input.cancelledOnLabel}`
          : 'This booking was cancelled',
        body: 'Questions about a refund? Message your host.',
        tone: 'muted',
      };
  }
}

// ---------------------------------------------------------------------------------------------
// Next action
// ---------------------------------------------------------------------------------------------

export type GuestTripNextActionKind =
  | 'pay'
  | 'sd_form'
  | 'review'
  | 'stay_guide'
  | 'directions'
  | 'find_parking'
  | 'book_again'
  | 'message_host';

/** Blockers first (money, refund form), then what the phase needs, then talking to the host. */
export function guestTripNextAction(input: {
  phase: GuestTripPhase;
  amountDue: number;
  sdFormAvailable: boolean;
  reviewAvailable: boolean;
  reviewSubmitted: boolean;
  stayGuideAvailable: boolean;
  directionsAvailable: boolean;
  parkingFindAvailable: boolean;
}): GuestTripNextActionKind {
  const { phase } = input;
  if (phase === 'cancelled' || phase === 'requested') return 'message_host';
  if (input.sdFormAvailable) return 'sd_form';
  if (isGuestTripActive(phase) && input.amountDue > 0) return 'pay';
  if (input.reviewAvailable && !input.reviewSubmitted) return 'review';
  if (phase === 'completed') return 'book_again';
  if (phase === 'arrival_day') {
    if (input.stayGuideAvailable) return 'stay_guide';
    if (input.directionsAvailable) return 'directions';
  }
  if ((phase === 'staying' || phase === 'checkout_day') && input.stayGuideAvailable) {
    return 'stay_guide';
  }
  if ((phase === 'confirmed' || phase === 'arriving') && input.parkingFindAvailable) {
    return 'find_parking';
  }
  if (phase === 'arriving' && input.stayGuideAvailable) return 'stay_guide';
  return 'message_host';
}

// ---------------------------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------------------------

export type GuestTripChecklistItem = {
  key: 'payment' | 'documents' | 'parking';
  label: string;
  done: boolean;
  /** In-page anchor or app path. */
  href: string;
};

export function guestTripChecklist(input: {
  phase: GuestTripPhase;
  ratesConfirmed: boolean;
  totalBalance: number | null;
  amountDueLabel: string | null;
  documents: { status: 'ready' | 'pending' }[];
  parkingRequested: boolean;
  parkingReserved: boolean;
  parkingHref: string | null;
}): GuestTripChecklistItem[] {
  if (!isGuestTripActive(input.phase)) return [];
  const items: GuestTripChecklistItem[] = [];

  if (input.ratesConfirmed && (input.totalBalance ?? 0) > 0) {
    items.push({
      key: 'payment',
      label: input.amountDueLabel ? `${input.amountDueLabel} left to pay` : 'Paid in full',
      done: !input.amountDueLabel,
      href: '#trip-payment',
    });
  }

  const inStay = input.phase === 'staying' || input.phase === 'checkout_day';
  if (input.documents.length > 0 && !inStay) {
    const ready = input.documents.filter((doc) => doc.status === 'ready').length;
    const total = input.documents.length;
    items.push({
      key: 'documents',
      label:
        ready === total
          ? 'Check-in documents approved'
          : total > 1
            ? `Check-in documents: ${ready} of ${total} approved`
            : 'Check-in documents in progress',
      done: ready === total,
      href: '#trip-documents',
    });
  }

  if (input.parkingRequested) {
    items.push({
      key: 'parking',
      label: input.parkingReserved ? 'Parking reserved' : 'Parking not reserved yet',
      done: input.parkingReserved,
      href: input.parkingHref ?? '#trip-arrival',
    });
  }

  return items;
}

// ---------------------------------------------------------------------------------------------
// Account list + misc labels
// ---------------------------------------------------------------------------------------------

/** Account list grouping: active/upcoming first, then past, then cancelled. */
export function guestTripListGroup(input: {
  status: string;
  checkOutYmd: string;
  todayYmd: string;
}): 'upcoming' | 'past' | 'cancelled' {
  const status = input.status.trim();
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'COMPLETED') return 'past';
  if (status === 'READY_FOR_CHECKOUT' || status === 'PENDING_SD_REFUND') return 'upcoming';
  return input.checkOutYmd < input.todayYmd ? 'past' : 'upcoming';
}

/** Short pill label for list rows (account Trips tab). */
export function guestTripStatusLabel(status: string): string {
  const s = status.trim();
  if (s === 'CANCELLED') return 'Cancelled';
  if (s === 'PENDING_REVIEW') return 'Requested';
  if (CONFIRMED_STATUSES.has(s)) return 'Confirmed';
  if (s === 'READY_FOR_CHECKIN') return 'Ready';
  if (s === 'READY_FOR_CHECKOUT') return 'Checked out';
  if (s === 'PENDING_SD_REFUND') return 'Refund in progress';
  if (s === 'COMPLETED') return 'Completed';
  return 'Booked';
}

export function guestTripStatusTone(status: string): GuestTripTone {
  const s = status.trim();
  if (s === 'CANCELLED') return 'muted';
  if (s === 'READY_FOR_CHECKIN') return 'success';
  if (s === 'READY_FOR_CHECKOUT') return 'warning';
  if (s === 'COMPLETED') return 'neutral';
  return 'info';
}

/** Marketplace parking request (`guest_submissions` parking row) → guest label. */
export function guestTripParkingStatusLabel(status: string | null): string {
  switch ((status ?? '').trim()) {
    case 'PENDING_HOST_ACCEPTANCE':
      return 'Finding a host';
    case 'PENDING_PAYMENT':
      return 'Waiting for payment';
    case 'PENDING_REVIEW':
      return 'Payment under review';
    case 'COMPLETED':
      return 'Completed';
    case '':
      return 'Requested';
    default:
      return 'Reserved';
  }
}

/** Parking statuses where the slot is secured for the stay. */
export function isGuestTripParkingReserved(status: string | null): boolean {
  return ['READY_FOR_CHECKIN', 'READY_FOR_CHECKOUT', 'COMPLETED'].includes((status ?? '').trim());
}

/**
 * Listing rules that only restate check-in / check-out times; the arrival block already
 * shows them, so the rules list drops them.
 */
export function isGuestTripTimeRule(text: string): boolean {
  return /^\s*check[\s-]?(in|out)\b(\s*time)?\s*[:-]?\s*(after|before|from|by|until|at|\d)/i.test(
    text
  );
}
