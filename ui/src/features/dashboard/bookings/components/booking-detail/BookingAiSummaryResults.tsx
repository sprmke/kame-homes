/**
 * Shared AI Summary section results — used by the modal and the booking detail tab.
 * Verdicts sit in a ruled right column (stacked mark + label); findings stay on the left.
 */

import { useMemo, type ElementType } from 'react';

import {
  AlertTriangle,
  CalendarDays,
  Car,
  Check,
  Clock,
  MinusCircle,
  PawPrint,
  Receipt,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';

import type { BookingAssetPreviewHandler } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import {
  bookingAiSectionDocumentRefs,
  collectBookingAiDocumentRefs,
  linkifyBookingAiText,
  type BookingAiDocumentRef,
} from '@/features/dashboard/bookings/lib/bookingAiDocumentLinks';
import { isBookingAiReviewSectionStale } from '@/features/dashboard/bookings/lib/bookingAiReviewProgress';
import {
  resolveSectionOutcome,
  sanitizeAiReviewFlags,
  sanitizeAiReviewSummary,
  type SectionOutcome,
} from '@/features/dashboard/bookings/lib/bookingAiValidations';
import type {
  BookingAiReview,
  BookingAiReviewFlag,
  BookingAiReviewSectionResult,
  BookingAiReviewSectionStatus,
  BookingRow,
} from '@/features/dashboard/bookings/lib/types';

import { cn } from '@/lib/utils';

export type AiSummarySectionId = 'stay_details' | 'guests' | 'parking' | 'pets' | 'pricing';

export type AiSummarySectionDef = {
  id: AiSummarySectionId;
  label: string;
  icon: ElementType<{ className?: string }>;
  optional: (booking: BookingRow) => boolean;
};

export const AI_SUMMARY_SECTIONS: AiSummarySectionDef[] = [
  { id: 'stay_details', label: 'Stay', icon: CalendarDays, optional: () => false },
  { id: 'guests', label: 'Guests', icon: Users, optional: () => false },
  { id: 'parking', label: 'Parking', icon: Car, optional: () => false },
  { id: 'pets', label: 'Pets', icon: PawPrint, optional: (b) => !b.has_pets },
  { id: 'pricing', label: 'Pricing', icon: Receipt, optional: () => false },
];

/** Width of the verdict column — fits "Action needed" on one line at 11px. */
const STATUS_COLUMN = 'w-[104px]';

/**
 * `text-warning` is amber at 56% lightness and unreadable on a light tint, hence the
 * darker foreground token on light and the plain token on dark.
 */
function statusVisual(variant: SectionOutcome['variant']): {
  surface: string;
  text: string;
  icon?: ElementType<{ className?: string }>;
} {
  switch (variant) {
    case 'pass':
      return {
        surface: 'border-success/30 bg-success/10 text-success',
        text: 'text-success',
        icon: Check,
      };
    case 'review':
      return {
        surface: 'border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning',
        text: 'text-warning-foreground dark:text-warning',
        icon: AlertTriangle,
      };
    case 'issue':
      return {
        surface: 'border-destructive/30 bg-destructive/10 text-destructive',
        text: 'text-destructive',
        icon: X,
      };
    case 'checking':
      return { surface: 'border-primary/30 bg-primary/10 text-primary', text: 'text-primary' };
    case 'queued':
      return {
        surface: 'border-border bg-muted text-muted-foreground',
        text: 'text-muted-foreground',
        icon: Clock,
      };
    case 'stale':
      return {
        surface: 'border-border bg-muted text-muted-foreground',
        text: 'text-muted-foreground',
        icon: RotateCcw,
      };
    default:
      return {
        surface: 'border-border bg-muted text-muted-foreground',
        text: 'text-muted-foreground',
        icon: MinusCircle,
      };
  }
}

function StatusMark({ outcome, className }: { outcome: SectionOutcome; className?: string }) {
  const { surface, icon: Icon } = statusVisual(outcome.variant);
  return (
    <span
      className={cn('flex items-center justify-center rounded-full border', surface, className)}
      aria-hidden
    >
      {Icon ? (
        <Icon className="size-4" />
      ) : (
        <span className="bg-primary size-2 animate-pulse rounded-full" />
      )}
    </span>
  );
}

function SectionStatusStamp({ outcome }: { outcome: SectionOutcome }) {
  const { text } = statusVisual(outcome.variant);
  return (
    <span className="flex flex-col items-center gap-1.5">
      <StatusMark outcome={outcome} className="size-8" />
      <span className={cn('text-center text-[11px] font-semibold leading-tight', text)}>
        {outcome.label}
      </span>
    </span>
  );
}

function SectionStatusChip({ outcome }: { outcome: SectionOutcome }) {
  const { surface, text } = statusVisual(outcome.variant);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2.5 text-xs font-semibold',
        surface,
        text
      )}
    >
      <StatusMark outcome={outcome} className="size-5 border-0 bg-transparent" />
      {outcome.label}
    </span>
  );
}

function flagDotClasses(severity: BookingAiReviewFlag['severity']): string {
  if (severity === 'blocking') return 'bg-destructive';
  if (severity === 'warning') return 'bg-warning';
  return 'bg-muted-foreground/40';
}

function AiText({
  text,
  refs,
  muted = false,
  onPreview,
}: {
  text: string;
  refs: BookingAiDocumentRef[];
  muted?: boolean;
  onPreview?: BookingAssetPreviewHandler;
}) {
  if (!onPreview || refs.length === 0) return <>{text}</>;

  return (
    <>
      {linkifyBookingAiText(text, refs).map((segment, idx) =>
        segment.ref ? (
          <button
            key={idx}
            type="button"
            onClick={() => void onPreview(segment.ref!.label, segment.ref!.url)}
            className={cn(
              'focus-ring rounded font-medium underline decoration-dotted underline-offset-2',
              muted
                ? 'text-muted-foreground decoration-muted-foreground/40 hover:decoration-muted-foreground'
                : 'text-primary hover:decoration-primary decoration-primary/40'
            )}
            title={`Preview ${segment.ref.label}`}
          >
            {segment.text}
          </button>
        ) : (
          <span key={idx}>{segment.text}</span>
        )
      )}
    </>
  );
}

function FlagList({
  flags,
  refs,
  muted = false,
  onPreview,
}: {
  flags: BookingAiReviewFlag[];
  refs: BookingAiDocumentRef[];
  muted?: boolean;
  onPreview?: BookingAssetPreviewHandler;
}) {
  return (
    <ul className="mt-2 space-y-1.5">
      {flags.map((flag, idx) => (
        <li
          key={idx}
          className={cn(
            'flex gap-2 text-[13px] leading-relaxed',
            muted ? 'text-muted-foreground/70' : 'text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'mt-[7px] size-1.5 shrink-0 rounded-full',
              muted ? 'bg-muted-foreground/25' : flagDotClasses(flag.severity)
            )}
            aria-hidden
          />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <AiText text={flag.message} refs={refs} muted={muted} onPreview={onPreview} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function SectionResultRow({
  section,
  result,
  status,
  refs,
  stale = false,
  onPreview,
}: {
  section: AiSummarySectionDef;
  result?: BookingAiReviewSectionResult | null;
  status: BookingAiReviewSectionStatus;
  refs: BookingAiDocumentRef[];
  stale?: boolean;
  onPreview?: BookingAssetPreviewHandler;
}) {
  const outcome = resolveSectionOutcome(status, result, section.label, stale);
  const displaySummary = result
    ? sanitizeAiReviewSummary(result.summary, section.label)
    : undefined;
  const displayFlags = sanitizeAiReviewFlags(result?.flags ?? null, section.label);
  const sectionRefs = bookingAiSectionDocumentRefs(section.id, refs);
  const SectionIcon = section.icon;
  const hasBody = status === 'skipped' || Boolean(result);

  return (
    <div className="flex">
      <div className="min-w-0 flex-1 px-3.5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <SectionIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <h4 className="text-foreground truncate text-sm font-semibold tracking-tight">
              {section.label}
            </h4>
          </div>
          <span className="sm:hidden">
            <SectionStatusChip outcome={outcome} />
          </span>
        </div>

        {hasBody ? (
          <div className="mt-1.5 pl-6">
            {status === 'skipped' ? (
              <p className="text-muted-foreground text-[13px]">
                Nothing to check for this booking.
              </p>
            ) : (
              <>
                <p
                  className={cn(
                    'text-sm leading-relaxed [overflow-wrap:anywhere]',
                    stale ? 'text-muted-foreground' : 'text-foreground'
                  )}
                >
                  <AiText
                    text={displaySummary ?? ''}
                    refs={sectionRefs}
                    muted={stale}
                    onPreview={onPreview}
                  />
                </p>
                {displayFlags.length > 0 ? (
                  <FlagList
                    flags={displayFlags}
                    refs={sectionRefs}
                    muted={stale}
                    onPreview={onPreview}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'border-border bg-muted/30 hidden shrink-0 items-center justify-center border-l px-2 py-3.5 sm:flex',
          STATUS_COLUMN
        )}
      >
        <SectionStatusStamp outcome={outcome} />
      </div>
    </div>
  );
}

export function visibleAiSummarySections(booking: BookingRow): AiSummarySectionDef[] {
  return AI_SUMMARY_SECTIONS.filter((s) => !s.optional(booking));
}

export function aiSummarySectionStatus(
  row: BookingAiReview | null | undefined,
  id: AiSummarySectionId
): BookingAiReviewSectionStatus {
  return (
    (row?.[`${id}_status` as keyof BookingAiReview] as BookingAiReviewSectionStatus) ?? 'pending'
  );
}

export function aiSummarySectionResult(
  row: BookingAiReview | null | undefined,
  id: AiSummarySectionId
): BookingAiReviewSectionResult | null {
  return (
    (row?.[`${id}_result` as keyof BookingAiReview] as
      BookingAiReviewSectionResult | null | undefined) ?? null
  );
}

type ResultsListProps = {
  booking: BookingRow;
  review: BookingAiReview | null | undefined;
  onPreview?: BookingAssetPreviewHandler;
  /** Staggered fade when results first replace the running scan (modal only). */
  animateEntrance?: boolean;
  /** `bare` drops the outer frame for use inside a card that already provides one. */
  frame?: 'bordered' | 'bare';
};

export function BookingAiSummaryResultsList({
  booking,
  review,
  onPreview,
  animateEntrance = false,
  frame = 'bordered',
}: ResultsListProps) {
  const sections = useMemo(() => visibleAiSummarySections(booking), [booking]);
  const documentRefs = useMemo(() => collectBookingAiDocumentRefs(booking), [booking]);

  return (
    <div
      className={cn(
        'divide-border divide-y',
        frame === 'bordered' && 'border-border overflow-hidden rounded-lg border'
      )}
      aria-label="AI Summary results"
    >
      {sections.map((section, index) => (
        <div
          key={section.id}
          className={cn(
            animateEntrance &&
              'motion-safe:animate-fade-up motion-safe:[animation-fill-mode:backwards]'
          )}
          style={animateEntrance ? { animationDelay: `${index * 45}ms` } : undefined}
        >
          <SectionResultRow
            section={section}
            status={aiSummarySectionStatus(review, section.id)}
            result={aiSummarySectionResult(review, section.id)}
            refs={documentRefs}
            stale={isBookingAiReviewSectionStale(review, section.id)}
            onPreview={onPreview}
          />
        </div>
      ))}
    </div>
  );
}
