import { PDFDocument } from 'pdf-lib';

import {
  gafDetailsToPdfFormFields,
  type GafDetailsValues,
} from '@/features/dashboard/bookings/lib/gafDefaults';
import { applyGafOwnerSignatureBlock } from '@/features/dashboard/bookings/lib/gafPdfSignature';

const GAF_PDF_TEMPLATE_URL = '/templates/guest-form-template.pdf';

/** Sample guest-submitted values so admins can see where booking data lands on the GAF. */
const GAF_PREVIEW_SAMPLE_GUEST_FIELDS: Record<string, string> = {
  primaryGuestName: 'Juan Dela Cruz',
  guestEmail: 'guest@example.com',
  guestPhoneNumber: '0917 123 4567',
  guestAddress: '123 Sample Street, Makati City',
  nationality: 'Filipino',
  checkInDate: '06-15-2026',
  checkOutDate: '06-17-2026',
  checkInTime: '02:00 PM',
  checkOutTime: '11:00 AM',
  numberOfNights: '2',
  numberOfAdults: '2',
  numberOfChildren: '0',
  guest2Name: 'Maria Dela Cruz',
  guest3Name: '',
  guest4Name: '',
  guest5Name: '',
  carPlateNumber: 'ABC 1234',
  carBrandModel: 'Toyota Vios',
  carColor: 'White',
  carparkSlotNumber: 'P2-118',
};

let templateBytesCache: Uint8Array | null = null;

async function loadTemplateBytes(): Promise<Uint8Array> {
  if (templateBytesCache) return templateBytesCache;
  const res = await fetch(GAF_PDF_TEMPLATE_URL);
  if (!res.ok) {
    throw new Error(`Failed to load GAF template (${res.status})`);
  }
  templateBytesCache = new Uint8Array(await res.arrayBuffer());
  return templateBytesCache;
}

function buildGafPreviewFieldMappings(details: GafDetailsValues): Record<string, string> {
  return {
    ...GAF_PREVIEW_SAMPLE_GUEST_FIELDS,
    ...gafDetailsToPdfFormFields(details),
  };
}

export async function renderGafPdfPreview(
  details: GafDetailsValues,
  signatureUrl?: string | null
): Promise<Uint8Array> {
  const templateBytes = await loadTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const fieldMappings = buildGafPreviewFieldMappings(details);

  for (const [fieldName, value] of Object.entries(fieldMappings)) {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value ? String(value) : '');
    } catch {
      // Field missing or wrong type — skip silently for preview resilience.
    }
  }

  await applyGafOwnerSignatureBlock(pdfDoc, {
    unitOwner: details.gafUnitOwner,
    signatureUrl,
  });

  form.flatten();
  return pdfDoc.save();
}
