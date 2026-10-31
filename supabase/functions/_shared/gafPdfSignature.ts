/**
 * GAF PDF AcroForm fields for owner signature block.
 * Keep field names in sync with ui/src/features/dashboard/bookings/lib/gafPdfSignature.ts
 * and guest-form-template.pdf (Acrobat Prepare Form).
 */

import {
  PDFDocument,
  type PDFForm,
  type PDFPage,
  type PDFTextField,
  type PDFImage,
} from 'https://esm.sh/pdf-lib@1.17.1';

/** Adobe Sign suffix on the signature widget — use this exact name in code. */
const GAF_PDF_FIELD_UNIT_OWNER_SIGNATURE = 'unitOwnerSignature_es_:signer:signature';

const GAF_PDF_FIELD_UNIT_OWNER_SIGNATURE_NAME = 'unitOwnerSignatureName';

export const GAF_PDF_FIELD_CARPARK_SLOT_NUMBER = 'carparkSlotNumber';

export type GafOwnerSignatureBlockOptions = {
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

export function formatGafUnitOwnerPrintedName(unitOwner: string): string {
  return unitOwner.trim().toUpperCase();
}

export function setGafPdfTextField(
  form: PDFForm,
  fieldName: string,
  value: string | undefined | null
): void {
  try {
    const field = form.getTextField(fieldName);
    field.setText(value ? String(value) : '');
  } catch (err) {
    console.warn(
      `[gafPdfSignature] Could not set text field "${fieldName}":`,
      err instanceof Error ? err.message : err
    );
  }
}

function pageForField(pdfDoc: PDFDocument, field: PDFTextField): PDFPage | null {
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
  let field: PDFTextField;
  try {
    field = form.getTextField(GAF_PDF_FIELD_UNIT_OWNER_SIGNATURE);
  } catch (err) {
    console.warn(
      '[gafPdfSignature] Signature form field missing:',
      err instanceof Error ? err.message : err
    );
    return;
  }

  const widgets = field.acroField.getWidgets();
  if (widgets.length === 0) return;

  const rect = widgets[0].getRectangle();
  const page = pageForField(pdfDoc, field);
  if (!page) return;

  let bytes: Uint8Array;
  try {
    const res = await fetch(signatureUrl);
    if (!res.ok) {
      console.warn(`[gafPdfSignature] Failed to fetch signature (${res.status}): ${signatureUrl}`);
      return;
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.warn('[gafPdfSignature] Signature fetch error:', err);
    return;
  }

  if (bytes.length === 0) return;

  field.setText('');

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
    console.warn('[gafPdfSignature] Could not embed signature image:', err);
  }
}

/** Fill AcroForm printed name + optional uploaded signature image. */
export async function applyGafOwnerSignatureBlock(
  pdfDoc: PDFDocument,
  options: GafOwnerSignatureBlockOptions
): Promise<void> {
  const form = pdfDoc.getForm();
  setGafPdfTextField(
    form,
    GAF_PDF_FIELD_UNIT_OWNER_SIGNATURE_NAME,
    formatGafUnitOwnerPrintedName(options.unitOwner)
  );

  const url = options.signatureUrl?.trim();
  if (url) {
    await drawSignatureInFormField(pdfDoc, form, url);
  }
}
