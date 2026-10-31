import { format, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import type {
  MaintenanceExportType,
  MaintenanceItem,
  MaintenanceQuery,
  MaintenanceSummary,
} from '@/features/dashboard/maintenance/lib/types';

import { registerPdfFonts } from '@/lib/pdf/pdfFonts';
import { pdfIsoDate } from '@/lib/pdf/pdfFormatters';
import {
  addPageFooter,
  advanceSectionGap,
  applyPdfTableFootCell,
  baseAutoTableOptions,
  buildPdfReportHeaderOptions,
  contentWidth,
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
import { pdfMaintenanceStatusColor } from '@/lib/pdf/pdfStatusColors';
import { PDF_COLORS, PDF_LAYOUT, beginPdfTheme } from '@/lib/pdf/pdfTheme';

const REPORT_TYPE_LABEL: Record<MaintenanceExportType, string> = {
  combined: 'Maintenance report',
  overview: 'Maintenance overview',
  reminders: 'Reminders list',
};

const PDF_FILENAME_PREFIX: Record<MaintenanceExportType, string> = {
  combined: 'kame-maintenance-report',
  overview: 'kame-maintenance-overview',
  reminders: 'kame-maintenance-reminders',
};

function formatIsoDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

function periodRangeLabel(from: string | null, to: string | null): string {
  if (!from && !to) return 'All dates';
  if (from && to) return `${formatIsoDate(from)} – ${formatIsoDate(to)}`;
  if (from) return `From ${formatIsoDate(from)}`;
  return `Through ${formatIsoDate(to)}`;
}

function itemStatusLabel(item: MaintenanceItem): string {
  if (item.completed_at) return 'Done';
  if (item.telegram_reminder_enabled) return 'Pending';
  return '-';
}

type MaintenancePdfPayload = {
  query: MaintenanceQuery;
  summary: MaintenanceSummary;
  items: MaintenanceItem[];
  scopeLabel?: string | null;
  brandColor?: string | null;
};

function buildMaintenanceHeaderMeta(query: MaintenanceQuery): string[] {
  if (!query.q.trim()) return [];
  return [`Search: "${query.q.trim()}"`];
}

function appendOverviewSection(doc: jsPDF, y: number, summary: MaintenanceSummary): number {
  y = drawHeroMetric(doc, y, 'Total reminders', String(summary.total), PDF_COLORS.foreground);

  y = drawSectionEyebrow(doc, y, 'Summary', 'Totals for the selected period');
  y += 2;
  const kpis: PdfKpiItem[] = [
    { label: 'Telegram enabled', value: String(summary.telegramEnabled) },
    {
      label: 'Completed',
      value: String(summary.completed),
      accent: summary.completed > 0 ? 'positive' : 'neutral',
    },
    {
      label: 'Pending',
      value: String(summary.pending),
      accent: summary.pending > 0 ? 'estimate' : 'neutral',
    },
  ];
  y = drawKpiGrid(doc, y, kpis, 3);

  if (summary.byCategory.length > 0) {
    y = ensurePageSpace(doc, y, 60);
    y = drawSectionEyebrow(doc, y, 'By category');
    const tableW = contentWidth(doc);
    const categoryTotal = summary.byCategory.reduce((acc, row) => acc + row.count, 0);
    autoTable(doc, {
      ...baseAutoTableOptions(tableW),
      startY: y,
      head: [['Category', 'Count']],
      body: summary.byCategory.map((row) => [row.category, String(row.count)]),
      foot: [['Total', String(categoryTotal)]],
      columnStyles: {
        0: { cellWidth: tableW * 0.72, halign: 'left' },
        1: { cellWidth: tableW * 0.28, halign: 'left' },
      },
      didParseCell: (data) => {
        applyPdfTableFootCell(data, 99, { 1: 'left' });
      },
    });
    y = lastTableY(doc, y) + PDF_LAYOUT.afterBlock;
  }

  return y;
}

function appendRemindersSection(doc: jsPDF, y: number, items: MaintenanceItem[]): number {
  y = drawSectionEyebrow(
    doc,
    y,
    'Reminders',
    `${items.length} reminder${items.length === 1 ? '' : 's'} in period`
  );

  if (items.length === 0) {
    return drawEmptyState(doc, y, 'No reminders match the selected filters.');
  }

  const tableW = contentWidth(doc);
  const rows = items.map((item) => [
    pdfIsoDate(item.scheduled_on),
    item.label,
    item.category ?? '-',
    itemStatusLabel(item),
    item.notes?.trim() || '-',
  ]);

  autoTable(doc, {
    ...baseAutoTableOptions(tableW),
    startY: y,
    head: [['Date', 'Label', 'Category', 'Status', 'Notes']],
    body: rows,
    columnStyles: {
      0: { cellWidth: tableW * 0.14, halign: 'left' },
      1: { cellWidth: tableW * 0.28, overflow: 'linebreak', halign: 'left' },
      2: { cellWidth: tableW * 0.18, overflow: 'linebreak', halign: 'left' },
      3: { cellWidth: tableW * 0.12, halign: 'center' },
      4: { cellWidth: tableW * 0.28, overflow: 'linebreak', halign: 'left' },
    },
    didParseCell: (data) => {
      applyPdfTableFootCell(data);

      if (data.section !== 'body' || data.column.index !== 3) return;
      const status = String(data.cell.raw);
      data.cell.styles.textColor = pdfMaintenanceStatusColor(status);
      data.cell.styles.fontStyle = 'normal';
    },
  });

  return lastTableY(doc, y) + PDF_LAYOUT.afterBlock;
}

async function buildMaintenanceReportPdf(
  payload: MaintenancePdfPayload,
  type: MaintenanceExportType = 'combined'
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  beginPdfTheme(payload.brandColor);
  await registerPdfFonts(doc);
  paintPageBackground(doc);

  const range = periodRangeLabel(payload.query.from, payload.query.to);

  let y = drawReportHeader(
    doc,
    buildPdfReportHeaderOptions(
      REPORT_TYPE_LABEL[type],
      payload.scopeLabel,
      range,
      buildMaintenanceHeaderMeta(payload.query)
    )
  );

  if (type === 'overview' || type === 'combined') {
    y = appendOverviewSection(doc, y, payload.summary);
  }

  if (type === 'reminders' || type === 'combined') {
    y = advanceSectionGap(y);
    y = ensurePageSpace(doc, y, type === 'combined' && payload.items.length === 0 ? 40 : 70);
    y = appendRemindersSection(doc, y, payload.items);
  }

  addPageFooter(doc, 'Maintenance', payload.scopeLabel);
  return doc;
}

export async function downloadMaintenanceReportPdf(
  payload: MaintenancePdfPayload,
  type: MaintenanceExportType = 'combined'
): Promise<void> {
  const doc = await buildMaintenanceReportPdf(payload, type);
  const from = payload.query.from ?? 'all';
  const to = payload.query.to ?? 'all';
  const prefix = PDF_FILENAME_PREFIX[type];
  doc.save(`${prefix}_${from}_${to}.pdf`);
}
