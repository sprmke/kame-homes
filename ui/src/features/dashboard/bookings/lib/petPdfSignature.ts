/**
 * Pet registration PDF AcroForm fields for owner signature block.
 * Keep field names in sync with supabase/functions/_shared/petPdfSignature.ts
 * and pet-form-template.pdf (Acrobat Prepare Form).
 */

import {
  type PDFDocument,
  type PDFForm,
  type PDFImage,
  type PDFPage,
  type PDFSignature,
} from 'pdf-lib';

import {
  formatGafUnitOwnerPrintedName,
  setGafPdfTextField,
} from '@/features/dashboard/bookings/lib/gafPdfSignature';

const PET_PDF_FIELD_UNIT_OWNER_SIGNATURE = 'unitOwnerSignature';
const PET_PDF_FIELD_UNIT_OWNER_SIGNATURE_NAME = 'unitOwnerSignatureName';

export type PetOwnerSignatureBlockOptions = {
  unitOwner: string;
  signatureUrl?: string | null;
};

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

async function embedSignatureImage(pdfDoc: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
  if (isPng(bytes)) {
    return pdfDoc.embedPng(bytes);
  }
  return pdfDoc.embedJpg(bytes);
}

function pageForSignatureField(pdfDoc: PDFDocument, field: PDFSignature): PDFPage | null {
  const widgets = field.acroField.getWidgets();
  if (widgets.length === 0) return pdfDoc.getPages()[0] ?? null;

  const widgetPageRef = widgets[0].P();
  if (!widgetPageRef) return pdfDoc.getPages()[0] ?? null;

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    if (page.ref === widgetPageRef) return page;
  }
  return pages[0] ?? null;
}

async function drawSignatureInFormField(
  pdfDoc: PDFDocument,
  form: PDFForm,
  signatureUrl: string
): Promise<void> {
  let field: PDFSignature;
  try {
    field = form.getSignature(PET_PDF_FIELD_UNIT_OWNER_SIGNATURE);
  } catch {
    return;
  }

  const widgets = field.acroField.getWidgets();
  if (widgets.length === 0) return;

  const rect = widgets[0].getRectangle();
  const page = pageForSignatureField(pdfDoc, field);
  if (!page) return;

  const res = await fetch(signatureUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load signature image (${res.status})`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) return;

  const embedded = await embedSignatureImage(pdfDoc, bytes);
  const scaled = embedded.scaleToFit(rect.width, rect.height);
  const x = rect.x + (rect.width - scaled.width) / 2;
  const y = rect.y + (rect.height - scaled.height) / 2;

  page.drawImage(embedded, {
    x,
    y,
    width: scaled.width,
    height: scaled.height,
  });
}

/** Fill AcroForm printed name + optional uploaded signature image on the pet form. */
export async function applyPetOwnerSignatureBlock(
  pdfDoc: PDFDocument,
  options: PetOwnerSignatureBlockOptions
): Promise<void> {
  const form = pdfDoc.getForm();
  setGafPdfTextField(
    form,
    PET_PDF_FIELD_UNIT_OWNER_SIGNATURE_NAME,
    formatGafUnitOwnerPrintedName(options.unitOwner)
  );

  const url = options.signatureUrl?.trim();
  if (url) {
    await drawSignatureInFormField(pdfDoc, form, url);
  }
}
