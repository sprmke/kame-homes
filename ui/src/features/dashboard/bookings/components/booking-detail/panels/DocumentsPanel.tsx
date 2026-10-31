import { FolderOpen } from 'lucide-react';

import { DocPreview } from '@/features/dashboard/bookings/components/booking-detail/BookingDocPreview';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import { BookingDetailRowBlock } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailRow';
import type { ReceiptAiVerdict } from '@/features/dashboard/bookings/components/ReceiptAiVerdictBadge';
import { receiptAiPreviewLoading } from '@/features/dashboard/bookings/hooks/useReceiptAiBackfill';
import {
  ADMIN_GUEST_VIEW_SLOTS,
  shouldShowAdminGuestViewSlot,
} from '@/features/dashboard/bookings/lib/adminGuestSlots';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

type PreviewHandler = (label: string, rawUrl: string) => void;

type DocEntry = {
  label: string;
  url: string;
  receiptAiVerdict?: ReceiptAiVerdict;
  receiptAiLoading?: boolean;
  receiptAiVariant?: 'receipt' | 'valid_id';
};

/** Host scan order — money proof first, then who is staying, then operational docs. */
const FILE_GROUP_ORDER = ['payments', 'ids', 'parking', 'pets', 'approvals', 'booking'] as const;

type FileGroupId = (typeof FILE_GROUP_ORDER)[number];

const FILE_GROUP_LABEL: Record<FileGroupId, string> = {
  payments: 'Payments',
  ids: 'Guests',
  parking: 'Parking',
  pets: 'Pets',
  approvals: 'Approvals',
  booking: 'Booking',
};

type DocGroup = {
  id: FileGroupId;
  label: string;
  docs: DocEntry[];
};

function collectBookingFileGroups(
  booking: BookingRow,
  isDocumentAiBackfilling: boolean
): DocGroup[] {
  const buckets: Record<FileGroupId, DocEntry[]> = {
    payments: [],
    ids: [],
    parking: [],
    pets: [],
    approvals: [],
    booking: [],
  };

  const push = (
    group: FileGroupId,
    label: string,
    url: string | null | undefined,
    meta?: Pick<DocEntry, 'receiptAiVerdict' | 'receiptAiLoading' | 'receiptAiVariant'>
  ) => {
    const trimmed = url?.trim();
    if (!trimmed) return;
    buckets[group].push({ label, url: trimmed, ...meta });
  };

  push('booking', 'Booking PDF', booking.pdf_url);

  push('payments', 'Downpayment receipt', booking.payment_receipt_url, {
    receiptAiVerdict: booking.dp_receipt_ai_verdict,
    receiptAiLoading: receiptAiPreviewLoading(
      isDocumentAiBackfilling,
      booking.payment_receipt_url,
      booking.dp_receipt_ai_verdict
    ),
  });
  push('payments', 'Payment balance receipt', booking.guest_balance_payment_receipt_url, {
    receiptAiVerdict: booking.balance_receipt_ai_verdict,
    receiptAiLoading: receiptAiPreviewLoading(
      isDocumentAiBackfilling,
      booking.guest_balance_payment_receipt_url,
      booking.balance_receipt_ai_verdict
    ),
  });
  push('payments', 'SD refund receipt', booking.sd_refund_receipt_url, {
    receiptAiVerdict: booking.sd_refund_receipt_ai_verdict,
    receiptAiLoading: receiptAiPreviewLoading(
      isDocumentAiBackfilling,
      booking.sd_refund_receipt_url,
      booking.sd_refund_receipt_ai_verdict
    ),
  });
  push('payments', 'Parking payment receipt', booking.parking_payment_receipt_url, {
    receiptAiVerdict: booking.parking_receipt_ai_verdict,
    receiptAiLoading: receiptAiPreviewLoading(
      isDocumentAiBackfilling,
      booking.parking_payment_receipt_url,
      booking.parking_receipt_ai_verdict
    ),
  });

  push('ids', 'Valid ID', booking.valid_id_url, {
    receiptAiVerdict: booking.valid_id_ai_verdict,
    receiptAiLoading: receiptAiPreviewLoading(
      isDocumentAiBackfilling,
      booking.valid_id_url,
      booking.valid_id_ai_verdict
    ),
    receiptAiVariant: 'valid_id',
  });
  for (const slot of ADMIN_GUEST_VIEW_SLOTS) {
    // Primary ID is already listed as Valid ID above.
    if (slot.index === 1) continue;
    if (!shouldShowAdminGuestViewSlot(slot, booking)) continue;
    const validIdUrl = booking[slot.validIdUrlKey]?.trim();
    if (!validIdUrl) continue;
    push('ids', `${slot.label} valid ID`, validIdUrl, {
      receiptAiVerdict: slot.validIdAiVerdictKey ? booking[slot.validIdAiVerdictKey] : undefined,
      receiptAiLoading: slot.validIdAiVerdictKey
        ? receiptAiPreviewLoading(
            isDocumentAiBackfilling,
            validIdUrl,
            booking[slot.validIdAiVerdictKey]
          )
        : false,
      receiptAiVariant: 'valid_id',
    });
  }

  push('parking', 'Parking endorsement', booking.parking_endorsement_url);

  push('pets', 'Pet photo', booking.pet_image_url);
  push('pets', 'Vaccination record', booking.pet_vaccination_url);

  push('approvals', 'Approved GAF', booking.approved_gaf_pdf_url);
  push('approvals', 'Approved pet form', booking.approved_pet_pdf_url);

  return FILE_GROUP_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
    id,
    label: FILE_GROUP_LABEL[id],
    docs: buckets[id],
  }));
}

function FileGroupSection({ group, onPreview }: { group: DocGroup; onPreview: PreviewHandler }) {
  return (
    <section aria-labelledby={`files-group-${group.id}`} className="min-w-0">
      <h4 id={`files-group-${group.id}`} className="text-overline mb-2.5">
        {group.label}
      </h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.docs.map((d) => (
          <DocPreview
            key={`${d.label}-${d.url}`}
            label={d.label}
            url={d.url}
            onPreview={onPreview}
            receiptAiVerdict={d.receiptAiVerdict}
            receiptAiLoading={d.receiptAiLoading}
            receiptAiVariant={d.receiptAiVariant}
          />
        ))}
      </div>
    </section>
  );
}

export function DocumentsPanel({
  booking,
  onPreview,
  isDocumentAiBackfilling = false,
}: {
  booking: BookingRow;
  onPreview: PreviewHandler;
  isDocumentAiBackfilling?: boolean;
}) {
  const groups = collectBookingFileGroups(booking, isDocumentAiBackfilling);

  if (groups.length === 0) {
    return (
      <BookingDetailCard title="Files" icon={FolderOpen}>
        <BookingDetailRowBlock>
          <p className="text-muted-foreground text-sm">No files uploaded for this booking.</p>
        </BookingDetailRowBlock>
      </BookingDetailCard>
    );
  }

  return (
    <BookingDetailCard title="Files" icon={FolderOpen}>
      <BookingDetailRowBlock>
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <FileGroupSection key={group.id} group={group} onPreview={onPreview} />
          ))}
        </div>
      </BookingDetailRowBlock>
    </BookingDetailCard>
  );
}
