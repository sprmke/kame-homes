/**
 * Pet registration PDF AcroForm fields for owner signature block.
 * Keep field names in sync with ui/src/features/dashboard/bookings/lib/petPdfSignature.ts
 * and pet-form-template.pdf (Acrobat Prepare Form).
 */

import {
  PDFDocument,
  type PDFForm,
  type PDFImage,
  type PDFPage,
  type PDFSignature,
} from 'https://esm.sh/pdf-lib@1.17.1';
import { formatGafUnitOwnerPrintedName, setGafPdfTextField } from './gafPdfSignature.ts';

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
  } catch (err) {
    console.warn(
      '[petPdfSignature] Signature form field missing:',
      err instanceof Error ? err.message : err
    );
    return;
  }

  const widgets = field.acroField.getWidgets();
  if (widgets.length === 0) return;

  const rect = widgets[0].getRectangle();
  const page = pageForSignatureField(pdfDoc, field);
  if (!page) return;

  let bytes: Uint8Array;
  try {
    const res = await fetch(signatureUrl);
    if (!res.ok) {
      console.warn(`[petPdfSignature] Failed to fetch signature (${res.status}): ${signatureUrl}`);
      return;
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.warn('[petPdfSignature] Signature fetch error:', err);
    return;
  }

  if (bytes.length === 0) return;

  try {
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
  } catch (err) {
    console.warn('[petPdfSignature] Could not embed signature image:', err);
  }
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
