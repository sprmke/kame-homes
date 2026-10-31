import { PDFDocument } from 'pdf-lib';

import {
  petDetailsToPdfFormFields,
  type PetDetailsValues,
} from '@/features/dashboard/bookings/lib/petDefaults';
import { applyPetOwnerSignatureBlock } from '@/features/dashboard/bookings/lib/petPdfSignature';

const PET_PDF_TEMPLATE_URL = '/templates/pet-form-template.pdf';

/** Sample guest-submitted pet values for the admin live preview. */
const PET_PREVIEW_SAMPLE_GUEST_FIELDS: Record<string, string> = {
  checkInDate: '06-15-2026',
  petName: 'Buddy',
  petType: 'DOG',
  petAge: '3',
  petBreed: 'Golden Retriever',
  petVaccinationDate: '05-01-2026',
};

let templateBytesCache: Uint8Array | null = null;

async function loadTemplateBytes(): Promise<Uint8Array> {
  if (templateBytesCache) return templateBytesCache;
  const res = await fetch(PET_PDF_TEMPLATE_URL);
  if (!res.ok) {
    throw new Error(`Failed to load pet form template (${res.status})`);
  }
  templateBytesCache = new Uint8Array(await res.arrayBuffer());
  return templateBytesCache;
}

function buildPetPreviewFieldMappings(details: PetDetailsValues): Record<string, string> {
  return {
    ...PET_PREVIEW_SAMPLE_GUEST_FIELDS,
    ...petDetailsToPdfFormFields(details),
  };
}

export async function renderPetPdfPreview(
  details: PetDetailsValues,
  signatureUrl?: string | null
): Promise<Uint8Array> {
  const templateBytes = await loadTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const fieldMappings = buildPetPreviewFieldMappings(details);

  for (const [fieldName, value] of Object.entries(fieldMappings)) {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value ? String(value) : '');
    } catch {
      // Field missing or wrong type — skip silently for preview resilience.
    }
  }

  await applyPetOwnerSignatureBlock(pdfDoc, {
    unitOwner: details.gafUnitOwner,
    signatureUrl,
  });

  form.flatten();
  return pdfDoc.save();
}
