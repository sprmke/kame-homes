/**
 * Read-only status card for a PENDING_DOCUMENTS sub-step (GAF / pet / other)
 * when the rail is not showing a pricing/parking/sd form for that step.
 *
 * Paid — **Sent Docs** / **Pending Docs** (automatic email on Proceed).
 * Free — **To send** / **To Receive** (manual send via Automation Triggers).
 */

import { useId } from 'react';

import { CheckCircle2, FileClock, FileText, Mail, RefreshCw, Upload, XCircle } from 'lucide-react';

import { WorkflowSubFormCard } from '@/features/dashboard/bookings/components/WorkflowSubFormCard';
import type { BookingAssetPreviewHandler } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import { statusLabel } from '@/features/dashboard/bookings/lib/bookingStatus';
import {
  requirementApplies,
  type DocumentRequirement,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  docRejectionReasonLabel,
  formatDocReviewDate,
} from '@/features/dashboard/bookings/lib/documentReview';
import { pendingDocStepUsesApprovalModal } from '@/features/dashboard/bookings/lib/pendingDocApproval';
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

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { cn } from '@/lib/utils';

/** Right-column action link — matches `BookingCompactAssetControl` preview links. */
const DOC_ROW_ACTION =
  'text-primary text-xs font-semibold underline-offset-2 hover:underline hover:text-primary/90';

/** Right-column outstanding state — workflow amber, same family as incomplete stepper nodes. */
const DOC_ROW_PENDING = 'text-xs font-semibold text-amber-700 dark:text-amber-400';

const DOC_ROW_READY = 'text-muted-foreground text-xs font-semibold';

const DOC_ROW_SENT = 'text-primary text-xs font-semibold';

const DOC_STATUS_RECEIVED = 'text-emerald-700 dark:text-emerald-400';
const DOC_STATUS_AWAITING = 'text-amber-700 dark:text-amber-400';
const DOC_STATUS_REJECTED = 'text-destructive';

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
    case 'rejected':
      return 'Rejected';
    case 'awaiting':
      return 'Pending';
    default:
      return 'Pending';
  }
}

/** One-line review state under an inbound approval row label. */
function approvalStatusText(row: PendingDocStatusRow): string {
  if (row.status === 'received') {
    const date = formatDocReviewDate(row.receivedAt);
    return date ? `Received · ${date}` : 'Received';
  }
  if (row.status === 'rejected') {
    const reason = docRejectionReasonLabel(row.rejectedReason);
    const date = formatDocReviewDate(row.rejectedAt);
    return [reason ? `Rejected · ${reason}` : 'Rejected', date].filter(Boolean).join(' · ');
  }
  if (row.status === 'on-file') return 'Received · not complete';
  return 'Awaiting approval';
}

function approvalStatusTone(row: PendingDocStatusRow): string {
  if (row.status === 'received') return DOC_STATUS_RECEIVED;
  if (row.status === 'rejected') return DOC_STATUS_REJECTED;
  if (row.status === 'on-file') return 'text-muted-foreground';
  return DOC_STATUS_AWAITING;
}

function ApprovalStatusIcon({ status }: { status: PendingDocRowStatus }) {
  if (status === 'received' || status === 'on-file')
    return <CheckCircle2 className="size-3 shrink-0" aria-hidden />;
  if (status === 'rejected') return <XCircle className="size-3 shrink-0" aria-hidden />;
  return <FileClock className="size-3 shrink-0" aria-hidden />;
}

export function PendingDocSubStatusCard({
  booking,
  sub,
  requirements,
  plain = false,
  automatedBookingFlow = true,
  canUpload = false,
  onUpload,
  onReject,
  onPreview,
}: {
  booking: BookingRow;
  sub: PendingDocNestedKey;
  requirements: DocumentRequirement[];
  plain?: boolean;
  automatedBookingFlow?: boolean;
  /** Host can mutate this booking and upload a replacement approval file. */
  canUpload?: boolean;
  onUpload?: (sub: PendingDocNestedKey) => void;
  /** Opens the reject sheet for a received approval file. */
  onReject?: (sub: PendingDocNestedKey) => void;
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

  const canUploadApproval =
    canUpload &&
    !beforeRequestSent &&
    Boolean(onUpload) &&
    pendingDocStepUsesApprovalModal(sub, requirements);

  const canRejectApproval =
    canUpload &&
    !beforeRequestSent &&
    booking.status === 'PENDING_DOCUMENTS' &&
    Boolean(onReject) &&
    pendingDocStepUsesApprovalModal(sub, requirements);

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
        completion,
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
                        onUpload={
                          canUploadApproval &&
                          row.approvalRow &&
                          (row.status === 'awaiting' ||
                            row.status === 'rejected' ||
                            row.status === 'received')
                            ? () => onUpload?.(sub)
                            : undefined
                        }
                        onReject={
                          canRejectApproval && row.approvalRow && row.status === 'received'
                            ? () => onReject?.(sub)
                            : undefined
                        }
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
  onUpload,
  onReject,
}: {
  row: PendingDocStatusRow;
  statusUpdatedAt?: string | null;
  onPreview: BookingAssetPreviewHandler;
  /** Opens the approval upload sheet — awaiting, rejected, or replacing a received file. */
  onUpload?: () => void;
  /** Opens the reject sheet — received approval files only. */
  onReject?: () => void;
}) {
  const stored = row.url?.trim() ?? '';
  const Icon = stored ? FileText : FileClock;
  const actionLabel = rowStatusLabel(row.status, Boolean(row.approvalRow), Boolean(stored));
  const approvalStatus = row.approvalRow ? approvalStatusText(row) : null;
  const rejectionTitle = row.rejectionNote?.trim() || undefined;

  const menuActions = [
    ...(onUpload
      ? [
          {
            key: 'replace',
            label: stored ? 'Replace file' : 'Upload file',
            icon: <RefreshCw className="size-4" aria-hidden />,
            onSelect: onUpload,
          },
        ]
      : []),
    ...(onReject
      ? [
          {
            key: 'reject',
            label: 'Reject document',
            icon: <XCircle className="size-4" aria-hidden />,
            destructive: true,
            onSelect: onReject,
          },
        ]
      : []),
  ];

  return (
    <li className="flex min-h-11 items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
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
        {approvalStatus ? (
          <p
            className={cn(
              'mt-0.5 flex min-w-0 items-center gap-1 pl-[1.375rem] text-[11px] font-medium leading-snug',
              approvalStatusTone(row)
            )}
            title={rejectionTitle}
            aria-label={rejectionTitle ? `${approvalStatus}. ${rejectionTitle}` : undefined}
          >
            <ApprovalStatusIcon status={row.status} />
            <span className="truncate">{approvalStatus}</span>
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {stored ? (
          <button
            type="button"
            onClick={() => void onPreview(row.label, previewStorageUrl(stored, statusUpdatedAt))}
            aria-label={`View ${row.label}`}
            className={cn(
              'focus-ring inline-flex min-h-11 min-w-11 items-center justify-end rounded-md px-1',
              DOC_ROW_ACTION
            )}
          >
            View
          </button>
        ) : onUpload ? (
          <button
            type="button"
            onClick={onUpload}
            aria-label={`Upload ${row.label}`}
            className={cn(
              'focus-ring inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-1',
              DOC_ROW_ACTION
            )}
          >
            <Upload className="size-3.5 shrink-0" aria-hidden />
            Upload
          </button>
        ) : (
          <span
            className={cn(
              row.status === 'ready' && DOC_ROW_READY,
              row.status === 'missing' && DOC_ROW_PENDING,
              row.status === 'awaiting' && DOC_ROW_PENDING,
              row.status === 'rejected' && DOC_ROW_PENDING,
              row.status === 'on-file' && DOC_ROW_SENT
            )}
          >
            {actionLabel}
          </span>
        )}
        {menuActions.length > 0 ? (
          <ResponsiveOverflowMenu
            label={`Actions for ${row.label}`}
            sheetTitle={row.label}
            actionGroups={[menuActions]}
            triggerClassName="size-8"
          />
        ) : null}
      </div>
    </li>
  );
}
