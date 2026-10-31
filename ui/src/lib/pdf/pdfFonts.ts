import { PDF_FONT } from '@/lib/pdf/pdfTheme';

import type { jsPDF } from 'jspdf';

import boldFontUrl from '@/assets/fonts/PlusJakartaSans-Bold.ttf?url';
import extraBoldFontUrl from '@/assets/fonts/PlusJakartaSans-ExtraBold.ttf?url';
import regularFontUrl from '@/assets/fonts/PlusJakartaSans-Regular.ttf?url';
import semiFontUrl from '@/assets/fonts/PlusJakartaSans-SemiBold.ttf?url';

/** jsPDF style slots — mapped to static Plus Jakarta Sans cuts. */
export type PdfFontWeight = 'normal' | 'semibold' | 'bold' | 'heavy';

let fontData: Record<PdfFontWeight, string> | null = null;
let fontLoad: Promise<Record<PdfFontWeight, string>> | null = null;
let fontsReady = false;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  return arrayBufferToBase64(await res.arrayBuffer());
}

async function loadFontFiles(): Promise<Record<PdfFontWeight, string>> {
  if (fontData) return fontData;
  if (!fontLoad) {
    fontLoad = Promise.all([
      fetchFontBase64(regularFontUrl),
      fetchFontBase64(semiFontUrl),
      fetchFontBase64(boldFontUrl),
      fetchFontBase64(extraBoldFontUrl),
    ]).then(([regular, semibold, bold, heavy]) => {
      fontData = { normal: regular, semibold, bold, heavy };
      return fontData;
    });
  }
  return fontLoad;
}

/** Returns true when Plus Jakarta Sans was registered on the document. */
export async function registerPdfFonts(doc: jsPDF): Promise<boolean> {
  try {
    const fonts = await loadFontFiles();
    doc.addFileToVFS('PJS-Regular.ttf', fonts.normal);
    doc.addFileToVFS('PJS-SemiBold.ttf', fonts.semibold);
    doc.addFileToVFS('PJS-Bold.ttf', fonts.bold);
    doc.addFileToVFS('PJS-ExtraBold.ttf', fonts.heavy);
    doc.addFont('PJS-Regular.ttf', PDF_FONT, 'normal');
    doc.addFont('PJS-SemiBold.ttf', PDF_FONT, 'semibold');
    doc.addFont('PJS-Bold.ttf', PDF_FONT, 'bold');
    doc.addFont('PJS-ExtraBold.ttf', PDF_FONT, 'heavy');
    fontsReady = true;
    return true;
  } catch (error) {
    fontsReady = false;
    console.warn('[pdf] Plus Jakarta Sans unavailable; falling back to Helvetica', error);
    return false;
  }
}

export function setPdfFont(doc: jsPDF, weight: PdfFontWeight, size: number): void {
  if (fontsReady) {
    doc.setFont(PDF_FONT, weight);
  } else {
    const helveticaWeight =
      weight === 'normal' ? 'normal' : weight === 'semibold' ? 'normal' : 'bold';
    doc.setFont('helvetica', helveticaWeight);
  }
  doc.setFontSize(size);
}
