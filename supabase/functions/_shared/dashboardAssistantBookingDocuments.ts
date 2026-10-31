/**
 * Booking files the dashboard assistant may show in chat.
 * Same set the host already sees on the booking Files tab — bookings:view only.
 * URLs are stored storage paths, never signed (the UI signs at preview time).
 */

export type AssistantDocumentKind = 'image' | 'pdf' | 'file';
export type AssistantDocumentGroup = 'gaf' | 'pet' | 'receipt' | 'id' | 'parking' | 'booking';

export type AssistantBookingDocument = {
  id: string;
  label: string;
  group: AssistantDocumentGroup;
  kind: AssistantDocumentKind;
  url: string;
};

const DOCUMENT_KIND_VALUES = new Set<AssistantDocumentGroup>([
  'gaf',
  'pet',
  'receipt',
  'id',
  'parking',
  'booking',
]);

export function documentKindFromUrl(url: string): AssistantDocumentKind {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (/\.(jpg|jpeg|png|webp|gif|heic|heif)$/.test(path)) return 'image';
  if (/\.pdf$/.test(path)) return 'pdf';
  return 'file';
}

function pushDoc(
  docs: AssistantBookingDocument[],
  id: string,
  label: string,
  group: AssistantDocumentGroup,
  url: unknown
): void {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return;
  docs.push({ id, label, group, kind: documentKindFromUrl(trimmed), url: trimmed });
}

export function collectAssistantBookingDocuments(
  booking: Record<string, unknown>
): AssistantBookingDocument[] {
  const docs: AssistantBookingDocument[] = [];

  pushDoc(docs, 'approved_gaf', 'Approved GAF', 'gaf', booking.approved_gaf_pdf_url);
  pushDoc(docs, 'gaf_request', 'GAF request', 'gaf', booking.gaf_request_pdf_url);
  pushDoc(docs, 'approved_pet_form', 'Approved pet form', 'pet', booking.approved_pet_pdf_url);
  pushDoc(docs, 'pet_request', 'Pet request', 'pet', booking.pet_request_pdf_url);
  pushDoc(docs, 'pet_image', 'Pet photo', 'pet', booking.pet_image_url);
  pushDoc(docs, 'pet_vaccination', 'Vaccination record', 'pet', booking.pet_vaccination_url);

  pushDoc(docs, 'dp_receipt', 'Downpayment receipt', 'receipt', booking.payment_receipt_url);
  pushDoc(
    docs,
    'balance_receipt',
    'Payment balance receipt',
    'receipt',
    booking.guest_balance_payment_receipt_url
  );
  pushDoc(docs, 'sd_refund_receipt', 'SD refund receipt', 'receipt', booking.sd_refund_receipt_url);
  pushDoc(
    docs,
    'parking_receipt',
    'Parking payment receipt',
    'parking',
    booking.parking_payment_receipt_url
  );
  pushDoc(
    docs,
    'parking_endorsement',
    'Parking endorsement',
    'parking',
    booking.parking_endorsement_url
  );

  pushDoc(docs, 'guest1_valid_id', 'Valid ID', 'id', booking.valid_id_url);
  pushDoc(docs, 'guest2_valid_id', 'Second guest valid ID', 'id', booking.guest2_valid_id_url);
  pushDoc(docs, 'guest3_valid_id', 'Third guest valid ID', 'id', booking.guest3_valid_id_url);
  pushDoc(docs, 'guest4_valid_id', 'Fourth guest valid ID', 'id', booking.guest4_valid_id_url);
  pushDoc(docs, 'guest5_valid_id', 'Fifth guest valid ID', 'id', booking.guest5_valid_id_url);

  pushDoc(docs, 'booking_pdf', 'Booking PDF', 'booking', booking.pdf_url);

  return docs;
}

export function parseDocumentKindArgs(raw: unknown): AssistantDocumentGroup[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const kinds = raw
    .map((item) => String(item).trim().toLowerCase())
    .filter((item): item is AssistantDocumentGroup =>
      DOCUMENT_KIND_VALUES.has(item as AssistantDocumentGroup)
    );
  return kinds.length > 0 ? kinds : null;
}

export function filterDocumentsByKinds(
  docs: AssistantBookingDocument[],
  kinds: AssistantDocumentGroup[] | null
): AssistantBookingDocument[] {
  if (!kinds || kinds.length === 0) return docs;
  const wanted = new Set(kinds);
  return docs.filter((doc) => wanted.has(doc.group));
}

const GROUP_MISSING_LABEL: Record<AssistantDocumentGroup, string> = {
  gaf: 'Approved GAF',
  pet: 'Approved pet form',
  receipt: 'Payment receipt',
  id: 'Valid ID',
  parking: 'Parking document',
  booking: 'Booking PDF',
};

type DocumentRequest = {
  asked: boolean;
  groups: Set<AssistantDocumentGroup> | 'all';
};

export function documentsRequestedByMessage(message: string): DocumentRequest {
  const text = message.trim();
  if (!text) return { asked: false, groups: new Set() };

  const groups = new Set<AssistantDocumentGroup>();
  if (/\b(?:approved\s+)?gaf\b|\bguest\s+approval\s+form\b/i.test(text)) groups.add('gaf');
  if (
    /\b(?:approved\s+)?pet\s+(?:form|pdf|document|request)\b|\bpets?\s+photo\b|\bvaccination\b/i.test(
      text
    )
  ) {
    groups.add('pet');
  }
  if (
    /\b(?:down\s*payment|downpayment|\bdp\b|balance\s+receipt|payment\s+receipt|sd\s+refund\s+receipt)\b/i.test(
      text
    )
  ) {
    groups.add('receipt');
  }
  if (/\b(?:valid\s+id|government\s+id|guest\s+id|passport)\b/i.test(text)) groups.add('id');
  if (/\bparking\s+(?:endorsement|receipt|document)\b/i.test(text)) groups.add('parking');
  if (/\bbooking\s+pdf\b/i.test(text)) groups.add('booking');

  const wantsAnyFile =
    groups.size > 0 ||
    /\b(?:show|provide|send|open|display|attach|see)\b.{0,48}\b(?:file|files|document|documents|pdf|image|photo|photos)\b/i.test(
      text
    ) ||
    /\b(?:file|files|document|documents)\s+(?:for|on|of)\s+(?:this\s+)?booking\b/i.test(text);

  if (!wantsAnyFile) return { asked: false, groups };

  if (groups.size === 0) return { asked: true, groups: 'all' };
  return { asked: true, groups };
}

export function selectDocumentsForMessage(
  docs: AssistantBookingDocument[],
  message: string
): { files: AssistantBookingDocument[]; missingLabels: string[] } {
  const request = documentsRequestedByMessage(message);
  if (!request.asked) return { files: [], missingLabels: [] };

  if (request.groups === 'all') {
    return {
      files: docs,
      missingLabels: docs.length === 0 ? ['No files on this booking'] : [],
    };
  }

  const files: AssistantBookingDocument[] = [];
  const missingLabels: string[] = [];

  for (const group of request.groups) {
    const matches = docs.filter((doc) => doc.group === group);
    if (group === 'gaf') {
      const approved =
        matches.find((doc) => doc.id === 'approved_gaf') ??
        matches.find((doc) => /approved/i.test(doc.label)) ??
        matches.find((doc) => doc.group === 'gaf' && doc.id !== 'gaf_request') ??
        matches[0];
      const requestPdf = matches.find((doc) => doc.id === 'gaf_request');
      if (approved) files.push(approved);
      else {
        missingLabels.push(GROUP_MISSING_LABEL.gaf);
        if (requestPdf) files.push(requestPdf);
      }
      continue;
    }
    if (group === 'pet') {
      const approved = matches.find((doc) => doc.id === 'approved_pet_form');
      const specificPet = /\b(?:approved\s+)?pet\s+(?:form|pdf|document)\b/i.test(message);
      if (specificPet) {
        if (approved) files.push(approved);
        else {
          missingLabels.push(GROUP_MISSING_LABEL.pet);
          const requestPdf = matches.find((doc) => doc.id === 'pet_request');
          if (requestPdf) files.push(requestPdf);
        }
        continue;
      }
    }
    if (matches.length === 0) missingLabels.push(GROUP_MISSING_LABEL[group]);
    else files.push(...matches);
  }

  const seen = new Set<string>();
  return {
    files: files.filter((doc) => {
      if (seen.has(doc.url)) return false;
      seen.add(doc.url);
      return true;
    }),
    missingLabels: [...new Set(missingLabels)],
  };
}

export function documentsFromToolResults(toolResults: unknown[]): AssistantBookingDocument[] {
  const out: AssistantBookingDocument[] = [];
  const seen = new Set<string>();
  for (const item of toolResults) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const docs = (item as { documents?: unknown }).documents;
    if (!Array.isArray(docs)) continue;
    for (const raw of docs) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const rec = raw as Record<string, unknown>;
      const url = typeof rec.url === 'string' ? rec.url.trim() : '';
      const label = typeof rec.label === 'string' ? rec.label.trim() : '';
      if (!url || !label || seen.has(url)) continue;
      seen.add(url);
      const group = DOCUMENT_KIND_VALUES.has(rec.group as AssistantDocumentGroup)
        ? (rec.group as AssistantDocumentGroup)
        : 'booking';
      out.push({
        id: typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : url,
        label,
        group,
        kind:
          rec.kind === 'image' || rec.kind === 'pdf' || rec.kind === 'file'
            ? rec.kind
            : documentKindFromUrl(url),
        url,
      });
    }
  }
  return out;
}
