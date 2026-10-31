import { setPdfFont } from '@/lib/pdf/pdfFonts';
import {
  PDF_COLORS,
  PDF_FONT,
  PDF_LAYOUT,
  PDF_TYPE,
  drawCard,
  setPdfDraw,
  setPdfFill,
  setPdfText,
} from '@/lib/pdf/pdfTheme';

import type { jsPDF } from 'jspdf';
import type { CellHookData, UserOptions } from 'jspdf-autotable';

export const PDF_TABLE_MARGIN = {
  left: PDF_LAYOUT.margin,
  right: PDF_LAYOUT.margin,
  top: PDF_LAYOUT.margin,
  bottom: 18,
} as const;

function pdfTableStyles(): Partial<UserOptions['styles']> {
  return {
    font: PDF_FONT,
    fontSize: PDF_TYPE.table,
    cellPadding: { top: 3.2, right: 2.6, bottom: 3.2, left: 2.6 },
    textColor: PDF_COLORS.foreground,
    lineColor: PDF_COLORS.border,
    lineWidth: 0.08,
    overflow: 'linebreak',
    valign: 'middle',
  };
}

function pdfTableHeadStyles(): Partial<UserOptions['headStyles']> {
  return {
    fillColor: PDF_COLORS.card,
    textColor: PDF_COLORS.foreground,
    fontStyle: 'bold',
    fontSize: PDF_TYPE.table,
    halign: 'left',
    valign: 'middle',
    overflow: 'visible',
    cellPadding: { top: 3.2, right: 2.6, bottom: 3.2, left: 2.6 },
  };
}

function pdfTableFootStyles(): Partial<UserOptions['footStyles']> {
  return {
    fillColor: PDF_COLORS.card,
    textColor: PDF_COLORS.foreground,
    fontStyle: 'bold',
    fontSize: PDF_TYPE.table,
    cellPadding: { top: 3.2, right: 2.6, bottom: 3.2, left: 2.6 },
  };
}

/** Match body column alignment in table foot rows. */
export function pdfTableFootHalign(
  columnIndex: number,
  moneyFrom = 4
): 'left' | 'center' | 'right' {
  if (columnIndex >= moneyFrom) return 'right';
  if (columnIndex === 1 || columnIndex === 2) return 'center';
  return 'left';
}

export function applyPdfTableFootCell(
  data: CellHookData,
  moneyFrom = 4,
  columnHalign?: Partial<Record<number, 'left' | 'center' | 'right'>>
): void {
  if (data.section !== 'foot') return;
  data.cell.styles.fontStyle = 'bold';
  data.cell.styles.fontSize = PDF_TYPE.table;
  data.cell.styles.fillColor = PDF_COLORS.card;
  data.cell.styles.halign =
    columnHalign?.[data.column.index] ?? pdfTableFootHalign(data.column.index, moneyFrom);
}

export const PDF_TABLE_MONEY_COLUMN = {
  halign: 'right' as const,
  overflow: 'visible' as const,
  fontSize: PDF_TYPE.table,
  cellPadding: { top: 3.2, right: 2.4, bottom: 3.2, left: 1.8 },
};

export type PdfKpiAccent = 'positive' | 'negative' | 'neutral' | 'estimate';

export type PdfKpiItem = {
  label: string;
  value: string;
  accent?: PdfKpiAccent;
};

export type PdfReportHeaderOptions = {
  /** e.g. "Maintenance Report - Monaco 2612" */
  reportTitle: string;
  /** e.g. "Date Range: Aug 1, 2026 – Aug 31, 2026" */
  dateRangeLine: string;
  metaLines?: string[];
};

/** Title-case report label and merge scope: "Maintenance Report - Monaco 2612". */
export function buildPdfReportHeaderOptions(
  reportLabel: string,
  scopeLabel: string | null | undefined,
  range: string,
  metaLines?: string[]
): PdfReportHeaderOptions {
  const formatted = reportLabel.replace(/\b\w/g, (c) => c.toUpperCase());
  const scope = scopeLabel?.trim();
  return {
    reportTitle: scope ? `${formatted} - ${scope}` : formatted,
    dateRangeLine: `Date Range: ${range}`,
    metaLines,
  };
}

export function paintPageBackground(doc: jsPDF): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  setPdfFill(doc, PDF_COLORS.pageBg);
  doc.rect(0, 0, w, h, 'F');
}

export function startNewPage(doc: jsPDF): number {
  doc.addPage();
  paintPageBackground(doc);
  return PDF_LAYOUT.margin;
}

export function contentWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth() - PDF_LAYOUT.margin * 2;
}

export function lastTableY(doc: jsPDF, fallback: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((doc as any).lastAutoTable?.finalY as number | undefined) ?? fallback;
}

export function ensurePageSpace(doc: jsPDF, y: number, minBottom = 48): number {
  if (y > doc.internal.pageSize.getHeight() - minBottom) {
    return startNewPage(doc);
  }
  return y;
}

function accentRgb(accent: PdfKpiAccent): readonly [number, number, number] {
  if (accent === 'positive') return PDF_COLORS.success;
  if (accent === 'negative') return PDF_COLORS.destructive;
  if (accent === 'estimate') return PDF_COLORS.warning;
  return PDF_COLORS.foreground;
}

/** Report masthead — report title with scope, date range below. */
export function drawReportHeader(doc: jsPDF, options: PdfReportHeaderOptions): number {
  const m = PDF_LAYOUT.margin;
  const w = doc.internal.pageSize.getWidth();
  const cardW = w - m * 2;
  const cardY = 10;
  const cardH = 22;

  drawCard(doc, m, cardY, cardW, cardH, PDF_LAYOUT.cardRadius);

  const textX = m + 5;
  const titleMaxW = cardW - 10;

  setPdfFont(doc, 'heavy', PDF_TYPE.title);
  setPdfText(doc, PDF_COLORS.foreground);
  const titleLines = doc.splitTextToSize(options.reportTitle, titleMaxW);
  doc.text(titleLines.slice(0, 2), textX, cardY + 8);

  setPdfFont(doc, 'semibold', PDF_TYPE.caption);
  setPdfText(doc, PDF_COLORS.muted);
  doc.text(options.dateRangeLine, textX, cardY + 16);

  let y = cardY + cardH + PDF_LAYOUT.afterHeaderCard;

  for (const line of options.metaLines ?? []) {
    setPdfFont(doc, 'normal', PDF_TYPE.caption);
    setPdfText(doc, PDF_COLORS.muted);
    doc.text(line, m, y);
    y += PDF_LAYOUT.metaLine;
  }

  return y + PDF_LAYOUT.beforeBlock;
}

export function drawSectionEyebrow(
  doc: jsPDF,
  y: number,
  title: string,
  subtitle?: string
): number {
  const m = PDF_LAYOUT.margin;

  setPdfFont(doc, 'bold', PDF_TYPE.section);
  setPdfText(doc, PDF_COLORS.foreground);
  doc.text(title, m, y);

  if (subtitle) {
    y += 5;
    setPdfFont(doc, 'semibold', PDF_TYPE.caption);
    setPdfText(doc, PDF_COLORS.muted);
    doc.text(subtitle, m, y);
    return y + PDF_LAYOUT.afterSectionTitle;
  }

  return y + PDF_LAYOUT.afterSectionTitle + 2;
}

/** Extra gap before a major report section (overview → stays → transactions). */
export function advanceSectionGap(y: number): number {
  return y + PDF_LAYOUT.sectionLead;
}

/** Primary figure — white card with brand accent rail. */
export function drawHeroMetric(
  doc: jsPDF,
  y: number,
  label: string,
  value: string,
  valueColor: readonly [number, number, number],
  secondary?: string
): number {
  const m = PDF_LAYOUT.margin;
  const boxW = contentWidth(doc);
  const boxH = secondary ? 24 : 20;

  drawCard(doc, m, y, boxW, boxH, PDF_LAYOUT.contentRadius, { border: false });
  setPdfFill(doc, PDF_COLORS.primary);
  doc.rect(m, y + 1.2, 1.2, boxH - 2.4, 'F');

  setPdfFont(doc, 'bold', PDF_TYPE.overline);
  setPdfText(doc, PDF_COLORS.muted);
  doc.text(label.toUpperCase(), m + 6, y + 8);

  setPdfFont(doc, 'heavy', PDF_TYPE.hero);
  setPdfText(doc, valueColor);
  doc.text(value, m + 6, y + (secondary ? 16 : 17));

  if (secondary) {
    setPdfFont(doc, 'normal', PDF_TYPE.caption);
    setPdfText(doc, PDF_COLORS.muted);
    doc.text(secondary, m + 6, y + 21);
  }

  return y + boxH + PDF_LAYOUT.afterBlock;
}

export function drawKpiGrid(doc: jsPDF, y: number, items: PdfKpiItem[], cols = 3): number {
  const m = PDF_LAYOUT.margin;
  const boxW = contentWidth(doc);
  const gap = PDF_LAYOUT.kpiGap;
  const colW = (boxW - gap * (cols - 1)) / cols;
  const rowH = PDF_LAYOUT.kpiRowH;

  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = m + col * (colW + gap);
    const itemY = y + row * (rowH + gap);

    drawCard(doc, x, itemY, colW, rowH, 2.5);

    setPdfFont(doc, 'bold', PDF_TYPE.label);
    setPdfText(doc, PDF_COLORS.muted);
    const labelLines = doc.splitTextToSize(item.label, colW - 7);
    doc.text(labelLines.slice(0, 1), x + 3.5, itemY + 6.5);

    const c = accentRgb(item.accent ?? 'neutral');
    setPdfFont(doc, 'bold', PDF_TYPE.data);
    setPdfText(doc, c);
    const valueLines = doc.splitTextToSize(item.value, colW - 7);
    doc.text(valueLines[0], x + 3.5, itemY + 15);
  });

  const rows = Math.ceil(items.length / cols);
  return y + rows * (rowH + gap) + PDF_LAYOUT.sectionGap - gap;
}

export function drawEmptyState(doc: jsPDF, y: number, message: string): number {
  const m = PDF_LAYOUT.margin;
  const w = contentWidth(doc);
  const boxH = 14;

  drawCard(doc, m, y, w, boxH, 2.5, { fill: PDF_COLORS.emptyFill, border: false });

  setPdfFont(doc, 'normal', PDF_TYPE.body);
  setPdfText(doc, PDF_COLORS.muted);
  doc.text(message, m + w / 2, y + boxH / 2 + 1.1, { align: 'center', maxWidth: w - 14 });

  return y + boxH + PDF_LAYOUT.afterBlock;
}

export function drawBulletNotes(doc: jsPDF, y: number, lines: string[]): number {
  const m = PDF_LAYOUT.margin;
  const noteW = contentWidth(doc);

  setPdfFont(doc, 'normal', PDF_TYPE.caption);
  setPdfText(doc, PDF_COLORS.muted);

  for (const line of lines) {
    y = ensurePageSpace(doc, y, 16);
    const wrapped = doc.splitTextToSize(`• ${line}`, noteW);
    doc.text(wrapped, m, y);
    y += wrapped.length * 3.6 + 1.8;
  }

  return y + PDF_LAYOUT.afterBlock;
}

export function addPageFooter(doc: jsPDF, moduleLabel: string, scopeFooter?: string | null): void {
  const pages = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const m = PDF_LAYOUT.margin;
  const left = scopeFooter?.trim() ? `${scopeFooter.trim()} · ${moduleLabel}` : moduleLabel;

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    setPdfDraw(doc, PDF_COLORS.separator);
    doc.setLineWidth(0.12);
    doc.line(m, pageH - 12, pageW - m, pageH - 12);

    setPdfFont(doc, 'normal', PDF_TYPE.caption);
    setPdfText(doc, PDF_COLORS.muted);
    doc.text(left, m, pageH - 8);
    doc.text(`Page ${i} of ${pages}`, pageW - m, pageH - 8, { align: 'right' });
  }
}

export function baseAutoTableOptions(tableW: number): Partial<UserOptions> {
  return {
    tableWidth: tableW,
    margin: PDF_TABLE_MARGIN,
    styles: pdfTableStyles(),
    headStyles: pdfTableHeadStyles(),
    footStyles: pdfTableFootStyles(),
    alternateRowStyles: { fillColor: PDF_COLORS.tableStripe },
    showHead: 'everyPage',
    showFoot: 'lastPage',
  };
}
