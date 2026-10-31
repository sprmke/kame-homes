import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { statusLabel } from '@/features/dashboard/bookings/lib/bookingStatus';
import { financePeriodRangeLabel } from '@/features/dashboard/finance/lib/financeFilterLabels';
import type {
  FinanceBookingLedgerRow,
  FinanceExportType,
  FinanceLineItem,
  FinanceQuery,
  FinanceSummary,
} from '@/features/dashboard/finance/lib/types';

import {
  computeStayTableTotals,
  formatStayHostNetCell,
  formatStayHostNetFoot,
  stayHostNetFootIsEstimate,
  stayHostNetFootTotal,
  stayRowDisplayNet,
} from '@/lib/pdf/pdfFinanceTotals';
import { registerPdfFonts } from '@/lib/pdf/pdfFonts';
import { pdfBookingDate, pdfIsoDate, pdfMoney } from '@/lib/pdf/pdfFormatters';
import {
  PDF_TABLE_MONEY_COLUMN,
  addPageFooter,
  advanceSectionGap,
  applyPdfTableFootCell,
  baseAutoTableOptions,
  buildPdfReportHeaderOptions,
  contentWidth,
  drawBulletNotes,
  drawEmptyState,
  drawHeroMetric,
  drawKpiGrid,
  drawReportHeader,
  drawSectionEyebrow,
  ensurePageSpace,
  lastTableY,
  paintPageBackground,
  type PdfKpiItem,
} from '@/lib/pdf/pdfReportLayout';
import {
  pdfStatusTextColor,
  pdfEstimateTextColor,
  pdfIncomeTextColor,
  pdfExpenseTextColor,
} from '@/lib/pdf/pdfStatusColors';
import { PDF_COLORS, PDF_LAYOUT, beginPdfTheme, type PdfRgb } from '@/lib/pdf/pdfTheme';

const REPORT_TYPE_LABEL: Record<FinanceExportType, string> = {
  combined: 'Finance report',
  overview: 'Finance overview',
  stays: 'Stays ledger',
  operating: 'Transactions report',
};

function netColumnTextColor(isCompleted: boolean, net: number | null | undefined): PdfRgb {
  if (!isCompleted) return pdfEstimateTextColor();
  return (net ?? 0) >= 0 ? pdfIncomeTextColor() : pdfExpenseTextColor();
}

function buildFinanceHeaderMeta(query: FinanceQuery): string[] {
  if (!query.q.trim()) return [];
  return [`Search: "${query.q.trim()}"`];
}

function appendOverviewSection(doc: jsPDF, y: number, payload: FinancePdfPayload): number {
  const { summary } = payload;
  const { stays: s, operating: o, grandNet } = summary;

  const heroSecondary =
    s.projectedNetPipeline !== 0
      ? `Pipeline estimate ${pdfMoney(s.projectedNetPipeline)} (in progress)`
      : undefined;

  y = drawHeroMetric(
    doc,
    y,
    'Total net (PHP)',
    pdfMoney(grandNet),
    grandNet >= 0 ? PDF_COLORS.success : PDF_COLORS.destructive,
    heroSecondary
  );

  y = drawSectionEyebrow(doc, y, 'Summary', 'Key metrics for the selected period');
  y += 2;
  const overviewKpis: PdfKpiItem[] = [
    {
      label: 'Completed net',
      value: pdfMoney(s.hostNetCompleted),
      accent: s.hostNetCompleted > 0 ? 'positive' : s.hostNetCompleted < 0 ? 'negative' : 'neutral',
    },
    { label: 'Total booking rates', value: pdfMoney(s.bookingRate) },
    { label: 'Additional fees', value: pdfMoney(s.otherFees) },
    {
      label: 'Outstanding balance',
      value: pdfMoney(s.outstandingGuestBalance),
      accent: s.outstandingGuestBalance > 0 ? 'negative' : 'neutral',
    },
    { label: 'Stays in period', value: String(s.count) },
    { label: 'Completed stays', value: String(s.completedCount) },
    {
      label: 'Transactions net',
      value: pdfMoney(o.net),
      accent: o.net > 0 ? 'positive' : o.net < 0 ? 'negative' : 'neutral',
    },
    {
      label: 'Transactions income',
      value: pdfMoney(o.income),
      accent: o.income > 0 ? 'positive' : 'neutral',
    },
    {
      label: 'Transactions expenses',
      value: pdfMoney(o.expenses),
      accent: o.expenses > 0 ? 'negative' : 'neutral',
    },
  ];
  return drawKpiGrid(doc, y, overviewKpis);
}

function appendStaysSection(doc: jsPDF, y: number, payload: FinancePdfPayload): number {
  const { stays } = payload;
  const tableW = contentWidth(doc);

  y = drawSectionEyebrow(
    doc,
    y,
    'Stays',
    `${stays.length} stay${stays.length === 1 ? '' : 's'} in period`
  );

  if (stays.length === 0) {
    return drawEmptyState(doc, y, 'No stays match the selected filters.');
  }

  const stayTotals = computeStayTableTotals(stays);

  const stayRows = stays.map((row) => {
    const fin = row.financials;
    const guest = row.guest_facebook_name || row.primary_guest_name || '-';
    return [
      guest,
      pdfBookingDate(row.check_in_date),
      pdfBookingDate(row.check_out_date),
      statusLabel(row.status),
      pdfMoney(fin.bookingRate),
      pdfMoney(fin.otherFees),
      formatStayHostNetCell(fin),
    ];
  });

  const footHostNet = formatStayHostNetFoot(stayTotals.completedNet, stayTotals.pipelineNet);

  autoTable(doc, {
    ...baseAutoTableOptions(tableW),
    startY: y,
    // Short headers avoid mid-word wraps in narrow date columns.
    head: [['Guest', 'In', 'Out', 'Status', 'Rate', 'Fees', 'Host net']],
    body: stayRows,
    foot: [
      [
        'Totals',
        '',
        '',
        '',
        pdfMoney(stayTotals.bookingRate),
        pdfMoney(stayTotals.otherFees),
        footHostNet,
      ],
    ],
    columnStyles: {
      0: { cellWidth: tableW * 0.21, overflow: 'linebreak' },
      1: { cellWidth: tableW * 0.08, halign: 'center', overflow: 'visible' },
      2: { cellWidth: tableW * 0.08, halign: 'center', overflow: 'visible' },
      3: { cellWidth: tableW * 0.17, overflow: 'linebreak' },
      4: { ...PDF_TABLE_MONEY_COLUMN, cellWidth: tableW * 0.12 },
      5: { ...PDF_TABLE_MONEY_COLUMN, cellWidth: tableW * 0.11 },
      6: { ...PDF_TABLE_MONEY_COLUMN, cellWidth: tableW * 0.15 },
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        data.cell.styles.overflow = 'visible';
        data.cell.styles.halign =
          data.column.index >= 4
            ? 'right'
            : data.column.index >= 1 && data.column.index <= 2
              ? 'center'
              : 'left';
        return;
      }

      applyPdfTableFootCell(data);

      if (data.section === 'foot') {
        if (data.column.index === 6) {
          const total = stayHostNetFootTotal(stayTotals.completedNet, stayTotals.pipelineNet);
          if (stayHostNetFootIsEstimate(stayTotals.completedNet, stayTotals.pipelineNet)) {
            data.cell.styles.textColor = netColumnTextColor(false, total);
          } else {
            data.cell.styles.textColor = netColumnTextColor(true, stayTotals.completedNet);
          }
          data.cell.styles.overflow = 'visible';
        }
        return;
      }

      if (data.section !== 'body') return;

      const row = stays[data.row.index];
      if (!row) return;

      if (data.column.index === 3) {
        data.cell.styles.textColor = pdfStatusTextColor(row.status);
        data.cell.styles.fontStyle = 'normal';
        return;
      }

      const moneyCol = data.column.index >= 4 && data.column.index <= 6;
      if (!moneyCol) return;

      data.cell.styles.halign = 'right';
      data.cell.styles.overflow = 'visible';
      data.cell.styles.fontStyle = 'normal';

      if (data.column.index !== 6) return;

      const fin = row.financials;
      const net = stayRowDisplayNet(fin);
      if (fin.isCompleted) {
        data.cell.styles.fontStyle = 'bold';
      }
      data.cell.styles.textColor = netColumnTextColor(fin.isCompleted, net);
    },
  });

  return lastTableY(doc, y) + PDF_LAYOUT.afterBlock;
}

function appendOperatingSection(doc: jsPDF, y: number, payload: FinancePdfPayload): number {
  const { operating, summary } = payload;
  const tableW = contentWidth(doc);

  y = ensurePageSpace(doc, y, 56);

  const incomeTotal = summary.operating.income;
  const expenseTotal = summary.operating.expenses;
  const operatingNet = summary.operating.net;

  y = drawSectionEyebrow(
    doc,
    y,
    'Transactions',
    `${operating.length} transaction${operating.length === 1 ? '' : 's'} in period`
  );

  if (operating.length === 0) {
    return drawEmptyState(doc, y, 'No transactions in this period.');
  }

  y += 2;
  y = drawKpiGrid(doc, y, [
    {
      label: 'Income',
      value: pdfMoney(incomeTotal),
      accent: incomeTotal > 0 ? 'positive' : 'neutral',
    },
    {
      label: 'Expenses',
      value: pdfMoney(expenseTotal),
      accent: expenseTotal > 0 ? 'negative' : 'neutral',
    },
    {
      label: 'Transactions net',
      value: pdfMoney(operatingNet),
      accent: operatingNet > 0 ? 'positive' : operatingNet < 0 ? 'negative' : 'neutral',
    },
  ]);

  const opRows = operating.map((item) => {
    const amt = pdfMoney(Math.abs(item.amount));
    return [
      pdfIsoDate(item.occurred_on),
      item.kind === 'income' ? 'Income' : 'Expense',
      item.label,
      item.category ?? '-',
      item.kind === 'income' ? `+${amt}` : `-${amt}`,
    ];
  });

  autoTable(doc, {
    ...baseAutoTableOptions(tableW),
    startY: y,
    head: [['Date', 'Type', 'Label', 'Category', 'Amount']],
    body: opRows,
    foot: [
      ['Totals', '', '', '', `${operatingNet >= 0 ? '+' : '-'}${pdfMoney(Math.abs(operatingNet))}`],
    ],
    columnStyles: {
      0: { cellWidth: tableW * 0.16 },
      1: { cellWidth: tableW * 0.12 },
      2: { cellWidth: tableW * 0.28, overflow: 'linebreak' },
      3: { cellWidth: tableW * 0.24, overflow: 'linebreak', halign: 'left' },
      4: { ...PDF_TABLE_MONEY_COLUMN, cellWidth: tableW * 0.2, fontStyle: 'normal' },
    },
    didParseCell: (data) => {
      applyPdfTableFootCell(data, 4);

      if (data.section === 'head' && data.column.index === 4) {
        data.cell.styles.overflow = 'visible';
        data.cell.styles.halign = 'right';
        return;
      }

      if (data.section === 'foot' && data.column.index === 4) {
        data.cell.styles.textColor =
          operatingNet >= 0 ? pdfIncomeTextColor() : pdfExpenseTextColor();
        data.cell.styles.overflow = 'visible';
        return;
      }

      if (data.section !== 'body') return;

      if (data.column.index === 1) {
        const kind = String(data.cell.raw);
        if (kind === 'Income') {
          data.cell.styles.textColor = pdfIncomeTextColor();
        } else if (kind === 'Expense') {
          data.cell.styles.textColor = pdfExpenseTextColor();
        }
        return;
      }

      if (data.column.index === 4) {
        data.cell.styles.overflow = 'visible';
        data.cell.styles.halign = 'right';
        data.cell.styles.fontStyle = 'normal';
        const raw = String(data.cell.raw);
        if (raw.startsWith('+')) {
          data.cell.styles.textColor = pdfIncomeTextColor();
        } else if (raw.startsWith('-')) {
          data.cell.styles.textColor = pdfExpenseTextColor();
        }
      }
    },
  });

  return lastTableY(doc, y) + PDF_LAYOUT.afterBlock;
}

function appendReportDefinitions(doc: jsPDF, y: number): number {
  y = ensurePageSpace(doc, y, 48);
  y = drawSectionEyebrow(doc, y, 'Definitions');
  return drawBulletNotes(doc, y, [
    'Amounts are Philippine pesos (PHP).',
    'Booking rate = down payment + guest balance.',
    'Additional fees = pet fee + parking margin + additional guest fee (SD pass-through excluded).',
    'Host net = booking rate + additional fees + SD settlement profits − SD settlement expenses − parking owner rate (SD settlement only when completed).',
    'Stays table totals sum the rows shown. Host net footer is one combined total; est when any in-progress stays are included.',
    'Total net = completed host net + transactions net. In-progress host net (est) is shown separately in the hero pipeline line.',
  ]);
}

const PDF_FILENAME_PREFIX: Record<FinanceExportType, string> = {
  overview: 'kame-finance-overview',
  stays: 'kame-finance-stays',
  operating: 'kame-finance-transactions',
  combined: 'kame-finance-report',
};

export type FinancePdfPayload = {
  query: FinanceQuery;
  summary: FinanceSummary;
  stays: FinanceBookingLedgerRow[];
  operating: FinanceLineItem[];
  /** Tower + unit (or parking location) for header/footer. */
  scopeLabel?: string | null;
  /** Resolved property/org brand hex (sidebar primary). */
  brandColor?: string | null;
};

async function buildFinanceReportPdf(
  payload: FinancePdfPayload,
  type: FinanceExportType = 'combined'
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  beginPdfTheme(payload.brandColor);
  await registerPdfFonts(doc);
  paintPageBackground(doc);

  const range = financePeriodRangeLabel(payload.query.from, payload.query.to);

  let y = drawReportHeader(
    doc,
    buildPdfReportHeaderOptions(
      REPORT_TYPE_LABEL[type],
      payload.scopeLabel,
      range,
      buildFinanceHeaderMeta(payload.query)
    )
  );

  if (type === 'overview' || type === 'combined') {
    y = appendOverviewSection(doc, y, payload);
  }

  if (type === 'stays' || type === 'combined') {
    y = advanceSectionGap(y);
    y = ensurePageSpace(doc, y, type === 'combined' ? 90 : 80);
    y = appendStaysSection(doc, y, payload);
  }

  if (type === 'operating' || type === 'combined') {
    y = advanceSectionGap(y);
    y = ensurePageSpace(doc, y, 70);
    y = appendOperatingSection(doc, y, payload);
  }

  if (type === 'combined' || type === 'overview') {
    y = advanceSectionGap(y);
    y = ensurePageSpace(doc, y, 52);
    y = appendReportDefinitions(doc, y);
  }

  addPageFooter(doc, 'Finance', payload.scopeLabel);
  return doc;
}

export async function downloadFinanceReportPdf(
  payload: FinancePdfPayload,
  type: FinanceExportType = 'combined'
): Promise<void> {
  const doc = await buildFinanceReportPdf(payload, type);
  const from = payload.query.from ?? 'all';
  const to = payload.query.to ?? 'all';
  const prefix = PDF_FILENAME_PREFIX[type];
  doc.save(`${prefix}_${from}_${to}.pdf`);
}
