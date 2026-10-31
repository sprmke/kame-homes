import {
  type DocumentAiVerdictVariant,
  type ReceiptAiVerdict,
} from '@/features/dashboard/bookings/components/ReceiptAiVerdictBadge';
import { receiptAiPreviewLoading } from '@/features/dashboard/bookings/hooks/useReceiptAiBackfill';
import type {
  BookingAiReviewFlag,
  BookingAiReviewSectionResult,
  BookingAiReviewSectionStatus,
} from '@/features/dashboard/bookings/lib/types';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

export type BookingAiValidationItem = {
  id: string;
  label: string;
  url: string | null;
  verdict: ReceiptAiVerdict;
  summary: string | null;
  variant: DocumentAiVerdictVariant;
  loading: boolean;
};

function pushItem(
  items: BookingAiValidationItem[],
  item: Omit<BookingAiValidationItem, 'loading'> & { loading?: boolean }
) {
  const url = item.url?.trim() || null;
  const verdict = item.verdict;
  const hasVerdict = Boolean(verdict && String(verdict).toLowerCase() !== 'skipped');
  if (!url && !hasVerdict) return;
  items.push({
    ...item,
    url,
    summary: item.summary?.trim() || null,
    loading: item.loading ?? false,
  });
}

/** All AI-checked documents on a booking (receipts + primary valid ID). */
export function collectBookingAiValidations(
  booking: BookingRow,
  isDocumentAiBackfilling = false
): BookingAiValidationItem[] {
  const items: BookingAiValidationItem[] = [];

  pushItem(items, {
    id: 'dp_receipt',
    label: 'Downpayment receipt',
    url: booking.payment_receipt_url ?? null,
    verdict: booking.dp_receipt_ai_verdict,
    summary: booking.dp_receipt_ai_summary ?? null,
    variant: 'receipt',
    loading: receiptAiPreviewLoading(
      isDocumentAiBackfilling,
      booking.payment_receipt_url,
      booking.dp_receipt_ai_verdict
    ),
  });

  pushItem(items, {
    id: 'balance_receipt',
    label: 'Balance receipt',
    url: booking.guest_balance_payment_receipt_url ?? null,
    verdict: booking.balance_receipt_ai_verdict,
    summary: booking.balance_receipt_ai_summary ?? null,
    variant: 'receipt',
    loading: receiptAiPreviewLoading(
      isDocumentAiBackfilling,
      booking.guest_balance_payment_receipt_url,
      booking.balance_receipt_ai_verdict
    ),
  });

  pushItem(items, {
    id: 'parking_receipt',
    label: 'Parking payment receipt',
    url: booking.parking_payment_receipt_url ?? null,
    verdict: booking.parking_receipt_ai_verdict,
    summary: booking.parking_receipt_ai_summary ?? null,
    variant: 'receipt',
    loading: receiptAiPreviewLoading(
      isDocumentAiBackfilling,
      booking.parking_payment_receipt_url,
      booking.parking_receipt_ai_verdict
    ),
  });

  pushItem(items, {
    id: 'valid_id',
    label: 'Valid ID',
    url: booking.valid_id_url ?? null,
    verdict: booking.valid_id_ai_verdict,
    summary: booking.valid_id_ai_summary ?? null,
    variant: 'valid_id',
    loading: receiptAiPreviewLoading(
      isDocumentAiBackfilling,
      booking.valid_id_url,
      booking.valid_id_ai_verdict
    ),
  });

  for (let i = 2; i <= 5; i++) {
    const urlKey = `guest${i}_valid_id_url` as keyof BookingRow;
    const verdictKey = `guest${i}_valid_id_ai_verdict` as keyof BookingRow;
    const summaryKey = `guest${i}_valid_id_ai_summary` as keyof BookingRow;
    pushItem(items, {
      id: `guest${i}_valid_id`,
      label: `Valid ID (Guest ${i})`,
      url: (booking[urlKey] as string | null) ?? null,
      verdict: booking[verdictKey] as ReceiptAiVerdict,
      summary: (booking[summaryKey] as string | null) ?? null,
      variant: 'valid_id',
      loading: receiptAiPreviewLoading(
        isDocumentAiBackfilling,
        booking[urlKey] as string | null,
        booking[verdictKey] as ReceiptAiVerdict
      ),
    });
  }

  return items;
}

export function bookingAiValidationSeverityRank(verdict: ReceiptAiVerdict): number {
  switch (String(verdict ?? '').toLowerCase()) {
    case 'invalid':
      return 0;
    case 'unclear':
      return 1;
    case 'likely_valid':
      return 2;
    case 'valid':
      return 3;
    case 'skipped':
      return 4;
    default:
      return 5;
  }
}

const PROVIDER_ERROR_PATTERN =
  /gemini api error|groq api error|models\/gemini|no longer available|quota exceeded|all gemini keys exhausted/i;

export function isAiProviderErrorText(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return PROVIDER_ERROR_PATTERN.test(text);
}

/** Section title → the document name hosts expect to see in the note. */
function documentSubjectForSection(sectionLabel: string): string {
  switch (sectionLabel.trim().toLowerCase()) {
    case 'pets':
      return 'Pet submitted files';
    case 'pricing':
      return 'Downpayment receipt';
    case 'guests':
      return 'Guest ID';
    case 'parking':
      return 'Parking';
    case 'stay':
    case 'stay details':
      return 'Stay';
    default:
      return sectionLabel.trim() || 'Document';
  }
}

/**
 * Vague model openings ("Images show…") → named document ("Pet submitted files show…")
 * so cached and live results both name what was checked.
 */
export function clarifyDocumentSubject(text: string, subject: string): string {
  let out = text.trim();
  const label = subject.trim();
  if (!out || !label) return out;

  // Always rewrite hedges → conclusive "needs review", even when the note already
  // opens with the document name (early-return below would otherwise skip them).
  out = rewriteNeedsReviewWording(out, label);

  if (new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(out)) {
    return out;
  }

  const plural = /\bfiles\b/i.test(label) || /\band\b/i.test(label);
  const withVerb = (base: 'show' | 'display' | 'contain') =>
    plural ? `${label} ${base}` : `${label} ${base}s`;

  out = out.replace(
    /^(?:The\s+)?(?:uploaded\s+)?(?:images?|photos?|pictures?|files?|documents?|scans?)\s+(show|shows|display|displays|contain|contains|is|are)\b/i,
    (_m, verb: string) => {
      const v = String(verb).toLowerCase();
      if (v === 'show' || v === 'shows') return withVerb('show');
      if (v === 'display' || v === 'displays') return withVerb('display');
      if (v === 'contain' || v === 'contains') return withVerb('contain');
      return plural ? `${label} are` : `${label} is`;
    }
  );

  out = out.replace(/^(?:The\s+)?image\s+(shows|displays|contains)\b/i, (_m, verb: string) => {
    const v = String(verb).toLowerCase();
    if (v.startsWith('show')) return withVerb('show');
    if (v.startsWith('display')) return withVerb('display');
    return withVerb('contain');
  });

  out = out.replace(
    /^No pet photo or vaccination record present\.?$/i,
    `${label} uploaded, but neither shows a pet or a vaccination record.`
  );
  out = out.replace(
    /^Cannot verify parking amount: no receipt amount extracted\.?$/i,
    'Downpayment receipt uploaded, but no amount could be read, so the parking fee is unverified.'
  );

  return out;
}

/**
 * Plain host note for invalid/unclear verdicts: name the file, say what's wrong,
 * then ask for a review. No em dash or "verdict: reason" shape — that reads as
 * machine output. Mirrors `needsReviewText` server-side.
 */
function needsReviewText(label: string, verdict: 'invalid' | 'unclear'): string {
  return verdict === 'invalid'
    ? `${label} uploaded, but the file does not look like a valid document. Please review.`
    : `${label} uploaded, but the file is too unclear to confirm. Please review.`;
}

/** Legacy verdict leftovers (including the earlier em-dash form) → the plain note. */
function rewriteNeedsReviewWording(text: string, label: string): string {
  let out = text;
  out = out.replace(/^Pet documents marked invalid\.?$/i, needsReviewText(label, 'invalid'));
  out = out.replace(/^Pet documents marked unclear\.?$/i, needsReviewText(label, 'unclear'));
  out = out.replace(
    /^Receipt marked invalid\.?$/i,
    needsReviewText('Downpayment receipt', 'invalid')
  );
  out = out.replace(
    /^Receipt marked unclear\.?$/i,
    needsReviewText('Downpayment receipt', 'unclear')
  );
  out = out.replace(
    /^(.+?)\s+uploaded\s+—\s+needs review:\s+too unclear to verify\.?$/i,
    (_m, subject: string) => needsReviewText(subject.trim(), 'unclear')
  );
  out = out.replace(
    /^(.+?)\s+uploaded\s+—\s+needs review:\s+not a valid document\.?$/i,
    (_m, subject: string) => needsReviewText(subject.trim(), 'invalid')
  );
  out = out.replace(
    /^(.+?)\s+uploaded,\s+but\s+the\s+(?:photo|image|file)\s+is\s+too\s+unclear\s+to\s+confirm\.?$/i,
    (_m, subject: string) => needsReviewText(subject.trim(), 'unclear')
  );
  out = out.replace(
    /^(.+?)\s+uploaded,\s+but\s+the\s+(?:photo|image|file)\s+does\s+not\s+show\s+what\s+was\s+asked\s+for\.?$/i,
    (_m, subject: string) => needsReviewText(subject.trim(), 'invalid')
  );
  return out;
}

/** Length the server used to hard-cut stored notes at, before word-boundary clamping. */
const LEGACY_HARD_CUT_LENGTHS = [100, 120];

/**
 * Rows written before word-boundary clamping end mid-word ("Not transaction proo").
 * Drop the dangling fragment and mark the note as truncated so it reads as cut off
 * rather than misspelled.
 */
export function repairTruncatedAiText(text: string): string {
  const trimmed = text.trim();
  if (/[.!?…”"')\]]$/u.test(trimmed)) return trimmed;
  const nearLegacyCut = LEGACY_HARD_CUT_LENGTHS.some((limit) => trimmed.length >= limit - 4);
  if (!nearLegacyCut) return trimmed;

  const lastBreak = trimmed.lastIndexOf(' ');
  const body = lastBreak > Math.floor(trimmed.length * 0.5) ? trimmed.slice(0, lastBreak) : trimmed;
  return `${body.replace(/[\s,;:.…–—-]+$/u, '')}…`;
}

export function sanitizeAiReviewSummary(
  summary: string | null | undefined,
  sectionLabel: string
): string {
  const trimmed = summary?.trim();
  if (!trimmed || isAiProviderErrorText(trimmed)) {
    return `${sectionLabel} could not be checked.`;
  }
  return repairTruncatedAiText(
    clarifyDocumentSubject(trimmed, documentSubjectForSection(sectionLabel))
  );
}

export function sanitizeAiReviewFlags(
  flags: BookingAiReviewFlag[] | null | undefined,
  sectionLabel?: string
): BookingAiReviewFlag[] {
  if (!flags?.length) return [];
  const subject = sectionLabel ? documentSubjectForSection(sectionLabel) : '';
  return flags
    .filter((item) => !isAiProviderErrorText(item.message))
    .map((item) => ({
      ...item,
      message: repairTruncatedAiText(
        subject ? clarifyDocumentSubject(item.message, subject) : item.message
      ),
    }));
}

export type SectionOutcomeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type SectionOutcome = {
  tone: SectionOutcomeTone;
  label: string;
  variant:
    'pass' | 'review' | 'issue' | 'checking' | 'queued' | 'skipped' | 'unavailable' | 'stale';
};

/** Maps pipeline status + result flags to what the host should see (Pass vs Review vs Issue). */
export function resolveSectionOutcome(
  status: BookingAiReviewSectionStatus,
  result?: BookingAiReviewSectionResult | null,
  sectionLabel?: string,
  stale = false
): SectionOutcome {
  if (status === 'processing') {
    return { tone: 'info', label: 'Checking', variant: 'checking' };
  }
  if (stale) {
    return { tone: 'neutral', label: 'Outdated', variant: 'stale' };
  }
  if (status === 'failed') {
    const summary = result?.summary ?? '';
    if (
      isAiProviderErrorText(summary) ||
      (sectionLabel && summary === `${sectionLabel} could not be checked.`)
    ) {
      return { tone: 'neutral', label: 'Not checked', variant: 'unavailable' };
    }
    return { tone: 'danger', label: 'Action needed', variant: 'issue' };
  }
  if (status === 'skipped') {
    return { tone: 'neutral', label: 'Not applicable', variant: 'skipped' };
  }
  if (status === 'pending') {
    return { tone: 'neutral', label: 'Queued', variant: 'queued' };
  }

  const flags = sanitizeAiReviewFlags(result?.flags ?? null, sectionLabel);
  if (flags.some((flag) => flag.severity === 'blocking')) {
    return { tone: 'danger', label: 'Action needed', variant: 'issue' };
  }
  if (flags.some((flag) => flag.severity === 'warning')) {
    return { tone: 'warning', label: 'Needs review', variant: 'review' };
  }
  return { tone: 'success', label: 'Looks good', variant: 'pass' };
}

/** Invalid / unclear first so hosts see blockers immediately. */
export function sortBookingAiValidations(
  items: BookingAiValidationItem[]
): BookingAiValidationItem[] {
  return [...items].sort(
    (a, b) =>
      bookingAiValidationSeverityRank(a.verdict) - bookingAiValidationSeverityRank(b.verdict) ||
      a.label.localeCompare(b.label)
  );
}
