/**
 * Read-only status card for a PENDING_DOCUMENTS sub-step (GAF / pet / other)
 * when the rail is not showing a pricing/parking/sd form for that step.
 *
 * Paid — **Sent Docs** / **Pending Docs** (automatic email on Proceed).
 * Free — **To send** / **To Receive** (manual send via Automation Triggers).
 */

import { useId } from 'react';

import { FileClock, FileText, Mail } from 'lucide-react';

import { WorkflowSubFormCard } from '@/features/dashboard/bookings/components/WorkflowSubFormCard';
import type { BookingAssetPreviewHandler } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import { statusLabel } from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  requirementApplies,
  type DocumentRequirement,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  buildPendingDocStatusGroups,
  freeOutboundNeedsManualSend,
  type PendingDocRowStatus,
  type PendingDocStatusRow,
} from '@/features/dashboard/bookings/lib/pendingDocStatusGroups';
import { withStorageUrlCacheBust } from '@/features/dashboard/bookings/lib/storageUrls';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  getPendingDocumentsNestedCompletion,
  readDocumentCompletions,
  type PendingDocNestedKey,
} from '@/features/dashboard/bookings/lib/workflow';
import { nestedAdvanceDisplay } from '@/features/dashboard/bookings/lib/workflowAdvanceMode';

import { cn } from '@/lib/utils';

/** Right-column action link — matches `BookingCompactAssetControl` preview links. */
const DOC_ROW_ACTION =
  'text-primary text-xs font-semibold underline-offset-2 hover:underline hover:text-primary/90';

/** Right-column outstanding state — workflow amber, same family as incomplete stepper nodes. */
const DOC_ROW_PENDING = 'text-xs font-semibold text-amber-700 dark:text-amber-400';

const DOC_ROW_READY = 'text-muted-foreground text-xs font-semibold';

const DOC_ROW_SENT = 'text-primary text-xs font-semibold';

type DocStepState = 'not-required' | 'not-sent' | 'awaiting' | 'approved' | 'complete-without-file';

function previewStorageUrl(url: string, statusUpdatedAt: string | null | undefined): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/[?&]v=/.test(trimmed)) return trimmed;
  return withStorageUrlCacheBust(trimmed, statusUpdatedAt);
}

function resolveDocStepState({
  applies,
  beforeRequestSent,
  completed,
  approvedUrl,
}: {
  applies: boolean;
  beforeRequestSent: boolean;
  completed: boolean;
  approvedUrl: string | null;
}): DocStepState {
  if (!applies) return 'not-required';
  if (beforeRequestSent) return 'not-sent';
  if (completed) return approvedUrl ? 'approved' : 'complete-without-file';
  return 'awaiting';
}

function rowStatusLabel(
  status: PendingDocRowStatus,
  approvalRow: boolean,
  hasUrl: boolean
): string {
  if (hasUrl) return approvalRow ? 'Approved' : 'View';
  switch (status) {
    case 'missing':
      return 'Missing';
    case 'ready':
      return 'Ready';
    case 'awaiting':
      return 'Pending';
    default:
      return 'Pending';
  }
}

export function PendingDocSubStatusCard({
  booking,
  sub,
  requirements,
  plain = false,
  automatedBookingFlow = true,
  onPreview,
}: {
  booking: BookingRow;
  sub: PendingDocNestedKey;
  requirements: DocumentRequirement[];
  plain?: boolean;
  automatedBookingFlow?: boolean;
  onPreview: BookingAssetPreviewHandler;
}) {
  const groupIdPrefix = useId();
  const { byRequirementId } = getPendingDocumentsNestedCompletion(booking, requirements);
  const requirement = requirements.find((req) => req.id === sub);
  const applies = requirement ? requirementApplies(requirement, booking) : false;
  const completion = readDocumentCompletions(booking)[sub];
  const approvedUrl = completion?.approvedPdfUrl?.trim() ? completion.approvedPdfUrl : null;
  const beforeRequestSent = booking.status === 'PENDING_REVIEW' || booking.status === 'IMPORTED';
  const state = resolveDocStepState({
    applies,
    beforeRequestSent,
    completed: byRequirementId[sub] ?? false,
    approvedUrl,
  });

  const subStepCompleted = state === 'approved' || state === 'complete-without-file';
  const groups = applies
    ? buildPendingDocStatusGroups({
        booking,
        requirements,
        requirement,
        sub,
        approvedUrl,
        approvalCompleted: subStepCompleted,
        automatedBookingFlow,
      })
    : [];
  const showManualSendHint = !automatedBookingFlow && freeOutboundNeedsManualSend(groups);

  const advanceDisplay = nestedAdvanceDisplay(sub, requirement?.approvalSource, {
    automatedBookingFlow,
  });

  return (
    <WorkflowSubFormCard
      title={requirement?.label ?? statusLabel(sub)}
      plain={plain}
      bodyClassName="space-y-3.5"
      advanceDisplay={advanceDisplay}
      upgradeFeature={automatedBookingFlow ? undefined : 'automatedBookingFlow'}
    >
      {groups.length > 0 ? (
        <div className="space-y-3">
          <div className="border-border/70 divide-separator divide-y overflow-hidden rounded-lg border">
            {groups.map((group) => {
              const headingId = `${groupIdPrefix}-${group.key}`;
              const isFreeOutbound = !automatedBookingFlow && group.key === 'outbound';
              const packageSent = isFreeOutbound && group.summary.startsWith('Sent');
              const packageWaiting = isFreeOutbound && group.summary === 'Not sent';

              return (
                <section key={group.key}>
                  <div
                    className={cn(
                      'border-separator flex items-center justify-between gap-2 border-b px-3 py-1.5',
                      isFreeOutbound && packageWaiting && 'bg-amber-500/5',
                      isFreeOutbound && packageSent && 'bg-primary/5'
                    )}
                  >
                    <h4
                      id={headingId}
                      className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
                    >
                      {isFreeOutbound && packageWaiting ? (
                        <Mail
                          className="size-3 shrink-0 text-amber-700 dark:text-amber-400"
                          aria-hidden
                        />
                      ) : null}
                      <span className="truncate">{group.label}</span>
                    </h4>
                    <span
                      className={cn(
                        'shrink-0 text-[11px] font-medium tabular-nums',
                        packageWaiting && 'font-semibold text-amber-700 dark:text-amber-400',
                        packageSent && 'text-primary font-semibold'
                      )}
                    >
                      {group.summary}
                    </span>
                  </div>
                  <ul className="divide-border/60 divide-y" aria-labelledby={headingId}>
                    {group.rows.map((row) => (
                      <DocLinkRow
                        key={row.label}
                        row={row}
                        statusUpdatedAt={booking.status_updated_at}
                        onPreview={onPreview}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          {showManualSendHint ? (
            <p className="text-muted-foreground text-[11px] leading-snug">
              Send from Automation Triggers below when every file is ready.
            </p>
          ) : null}
        </div>
      ) : null}
    </WorkflowSubFormCard>
  );
}

function DocLinkRow({
  row,
  statusUpdatedAt,
  onPreview,
}: {
  row: PendingDocStatusRow;
  statusUpdatedAt?: string | null;
  onPreview: BookingAssetPreviewHandler;
}) {
  const stored = row.url?.trim() ?? '';
  const Icon = stored ? FileText : FileClock;
  const actionLabel = rowStatusLabel(row.status, Boolean(row.approvalRow), Boolean(stored));

  return (
    <li className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
      <span
        className={cn(
          'flex min-w-0 items-center gap-2 text-xs font-medium',
          stored ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        <Icon
          className={cn('size-3.5 shrink-0', stored ? 'text-muted-foreground' : 'opacity-60')}
          aria-hidden
        />
        <span className="truncate">{row.label}</span>
      </span>
      {stored ? (
        <button
          type="button"
          onClick={() => void onPreview(row.label, previewStorageUrl(stored, statusUpdatedAt))}
          aria-label={`View ${row.label}`}
          className={cn(
            'focus-ring inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end rounded-md px-1',
            DOC_ROW_ACTION
          )}
        >
          {actionLabel}
        </button>
      ) : (
        <span
          className={cn(
            row.status === 'ready' && DOC_ROW_READY,
            row.status === 'missing' && DOC_ROW_PENDING,
            row.status === 'awaiting' && DOC_ROW_PENDING,
            row.status === 'on-file' && DOC_ROW_SENT
          )}
        >
          {actionLabel}
        </span>
      )}
    </li>
  );
}
