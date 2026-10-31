/**
 * Plan-aware doc checklist groups for GAF / pet approval cards on the workflow rail.
 *
 * Paid — outbound files were emailed automatically on Proceed; inbound is the signed copy back.
 * Free — nothing sends automatically; outbound is the package to send from Automation Triggers.
 */

import type { BookingWorkflowEmailKind } from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';
import {
  hasApplicableDocumentPdfTemplate,
  requirementDocKind,
  type DocumentRequirement,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type { PendingDocNestedKey } from '@/features/dashboard/bookings/lib/workflow';

export type PendingDocRowStatus = 'missing' | 'ready' | 'on-file' | 'awaiting' | 'received';

export type PendingDocStatusRow = {
  label: string;
  url: string | null | undefined;
  status: PendingDocRowStatus;
  /** Inbound signed copy — "Approved" instead of "View" when on file. */
  approvalRow?: boolean;
};

export type PendingDocStatusGroup = {
  key: 'outbound' | 'inbound';
  label: string;
  /** Short summary beside the group title (e.g. 2 of 3 ready · Not sent). */
  summary: string;
  rows: PendingDocStatusRow[];
};

function hasUrl(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

function validIdRows(booking: BookingRow): PendingDocStatusRow[] {
  const additional: Array<{ name: string | null; url: string | null; position: number }> = [
    { name: booking.guest2_name, url: booking.guest2_valid_id_url, position: 2 },
    { name: booking.guest3_name, url: booking.guest3_valid_id_url, position: 3 },
    { name: booking.guest4_name, url: booking.guest4_valid_id_url, position: 4 },
    { name: booking.guest5_name, url: booking.guest5_valid_id_url, position: 5 },
  ];

  const rows: PendingDocStatusRow[] = [
    {
      label: 'Valid ID',
      url: booking.valid_id_url,
      status: hasUrl(booking.valid_id_url) ? 'on-file' : 'missing',
    },
  ];

  for (const guest of additional) {
    if (!guest.name?.trim()) continue;
    rows.push({
      label: `Valid ID · Guest ${guest.position}`,
      url: guest.url,
      status: hasUrl(guest.url) ? 'on-file' : 'missing',
    });
  }

  return rows;
}

function requestPdfUrl(booking: BookingRow, kind: 'gaf' | 'pet'): string | null {
  const raw = kind === 'gaf' ? booking.gaf_request_pdf_url : booking.pet_request_pdf_url;
  const trimmed = raw?.trim() ?? '';
  return trimmed || null;
}

function manualEmailKindForDocKind(
  docKind: ReturnType<typeof requirementDocKind>
): BookingWorkflowEmailKind | null {
  if (docKind === 'gaf') return 'gaf_request';
  if (docKind === 'pet') return 'pet_request';
  return null;
}

function packageWasManuallySent(
  booking: BookingRow,
  kind: BookingWorkflowEmailKind | null
): boolean {
  if (!kind) return false;
  const sentAt = booking.workflow_email_manual_sent_at?.[kind];
  return typeof sentAt === 'string' && sentAt.trim().length > 0;
}

function applyFreeOutboundRowStatuses(
  rows: PendingDocStatusRow[],
  packageSent: boolean
): PendingDocStatusRow[] {
  return rows.map((row) => {
    if (!hasUrl(row.url)) return { ...row, status: 'missing' };
    if (packageSent) return { ...row, status: 'on-file' };
    return { ...row, status: 'ready' };
  });
}

function countReady(rows: PendingDocStatusRow[]): { ready: number; total: number } {
  const total = rows.length;
  const ready = rows.filter((row) => row.status !== 'missing').length;
  return { ready, total };
}

function paidOutboundSummary(rows: PendingDocStatusRow[]): string {
  const onFile = rows.filter((row) => hasUrl(row.url)).length;
  return `${onFile} of ${rows.length}`;
}

function freeOutboundSummary(rows: PendingDocStatusRow[], packageSent: boolean): string {
  const { ready, total } = countReady(rows);
  if (packageSent) return `Sent · ${total} of ${total}`;
  if (ready < total) return `${ready} of ${total} ready`;
  return 'Not sent';
}

function inboundRow(approvedUrl: string | null, completed: boolean): PendingDocStatusRow {
  return {
    label: 'Approved form',
    url: approvedUrl,
    approvalRow: true,
    status: hasUrl(approvedUrl) ? 'received' : completed ? 'on-file' : 'awaiting',
  };
}

export function buildPendingDocStatusGroups(input: {
  booking: BookingRow;
  requirements: DocumentRequirement[];
  requirement: DocumentRequirement | undefined;
  sub: PendingDocNestedKey;
  approvedUrl: string | null;
  approvalCompleted: boolean;
  automatedBookingFlow: boolean;
}): PendingDocStatusGroup[] {
  const {
    booking,
    requirements,
    requirement,
    sub,
    approvedUrl,
    approvalCompleted,
    automatedBookingFlow,
  } = input;
  const docKind = requirementDocKind(requirement, sub);
  const manualKind = manualEmailKindForDocKind(docKind);
  const packageSent = !automatedBookingFlow && packageWasManuallySent(booking, manualKind);

  if (docKind === 'gaf') {
    const outboundRows: PendingDocStatusRow[] = [];
    if (hasApplicableDocumentPdfTemplate(requirements, booking, 'gaf')) {
      const url = requestPdfUrl(booking, 'gaf');
      outboundRows.push({
        label: 'GAF Request',
        url,
        status: hasUrl(url) ? 'on-file' : 'missing',
      });
    }
    outboundRows.push(...validIdRows(booking));

    const outboundProcessed = automatedBookingFlow
      ? outboundRows.map((row) => ({
          ...row,
          status: hasUrl(row.url) ? ('on-file' as const) : ('awaiting' as const),
        }))
      : applyFreeOutboundRowStatuses(outboundRows, packageSent);

    const inboundRows: PendingDocStatusRow[] = [
      {
        label: 'Approved GAF',
        url: approvedUrl,
        approvalRow: true,
        status: hasUrl(approvedUrl) ? 'received' : 'awaiting',
      },
    ];

    return [
      {
        key: 'outbound',
        label: automatedBookingFlow ? 'Sent Docs' : 'To send',
        summary: automatedBookingFlow
          ? paidOutboundSummary(outboundProcessed)
          : freeOutboundSummary(outboundProcessed, packageSent),
        rows: outboundProcessed,
      },
      {
        key: 'inbound',
        label: automatedBookingFlow
          ? approvalCompleted
            ? 'Approved Docs'
            : 'Pending Docs'
          : 'To Receive',
        summary: `${inboundRows.filter((r) => hasUrl(r.url)).length} of ${inboundRows.length}`,
        rows: inboundRows,
      },
    ];
  }

  if (docKind === 'pet') {
    const outboundRows: PendingDocStatusRow[] = [];
    if (hasApplicableDocumentPdfTemplate(requirements, booking, 'pet')) {
      const url = requestPdfUrl(booking, 'pet');
      outboundRows.push({
        label: 'Pet Request Form',
        url,
        status: hasUrl(url) ? 'on-file' : 'missing',
      });
    }
    outboundRows.push(
      {
        label: 'Vaccination',
        url: booking.pet_vaccination_url,
        status: hasUrl(booking.pet_vaccination_url) ? 'on-file' : 'missing',
      },
      {
        label: 'Pet photo',
        url: booking.pet_image_url,
        status: hasUrl(booking.pet_image_url) ? 'on-file' : 'missing',
      }
    );

    const outboundProcessed = automatedBookingFlow
      ? outboundRows.map((row) => ({
          ...row,
          status: hasUrl(row.url) ? ('on-file' as const) : ('awaiting' as const),
        }))
      : applyFreeOutboundRowStatuses(outboundRows, packageSent);

    const inboundRows: PendingDocStatusRow[] = [
      {
        label: 'Approved Pet Request',
        url: approvedUrl,
        approvalRow: true,
        status: hasUrl(approvedUrl) ? 'received' : 'awaiting',
      },
    ];

    return [
      {
        key: 'outbound',
        label: automatedBookingFlow ? 'Sent Docs' : 'To send',
        summary: automatedBookingFlow
          ? paidOutboundSummary(outboundProcessed)
          : freeOutboundSummary(outboundProcessed, packageSent),
        rows: outboundProcessed,
      },
      {
        key: 'inbound',
        label: automatedBookingFlow
          ? approvalCompleted
            ? 'Approved Docs'
            : 'Pending Docs'
          : 'To Receive',
        summary: `${inboundRows.filter((r) => hasUrl(r.url)).length} of ${inboundRows.length}`,
        rows: inboundRows,
      },
    ];
  }

  const fallbackInbound = inboundRow(approvedUrl, approvalCompleted);
  return [
    {
      key: 'inbound',
      label: automatedBookingFlow
        ? approvalCompleted
          ? 'Approved Docs'
          : 'Pending Docs'
        : 'To Receive',
      summary: hasUrl(approvedUrl) ? '1 of 1' : '0 of 1',
      rows: [
        {
          ...fallbackInbound,
          label: 'Approved form',
        },
      ],
    },
  ];
}

export function freeOutboundNeedsManualSend(groups: PendingDocStatusGroup[]): boolean {
  const outbound = groups.find((g) => g.key === 'outbound');
  if (!outbound) return false;
  if (outbound.summary.startsWith('Sent')) return false;
  return outbound.rows.every((row) => row.status !== 'missing');
}
