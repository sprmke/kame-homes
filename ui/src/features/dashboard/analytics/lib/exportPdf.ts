import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { AnalyticsAiReviewRecord } from '@/features/dashboard/analytics/lib/aiReviewTypes';
import { collapseTopGuestOrigins } from '@/features/dashboard/analytics/lib/guestOriginsDisplay';
import type {
  AnalyticsBundle,
  AnalyticsPlaybookArticle,
} from '@/features/dashboard/analytics/lib/types';

import { registerPdfFonts } from '@/lib/pdf/pdfFonts';
import { pdfMoney } from '@/lib/pdf/pdfFormatters';
import {
  addPageFooter,
  advanceSectionGap,
  baseAutoTableOptions,
  buildPdfReportHeaderOptions,
  contentWidth,
  drawBulletNotes,
  drawHeroMetric,
  drawKpiGrid,
  drawReportHeader,
  drawSectionEyebrow,
  ensurePageSpace,
  lastTableY,
  paintPageBackground,
  type PdfKpiItem,
} from '@/lib/pdf/pdfReportLayout';
import { PDF_COLORS, beginPdfTheme } from '@/lib/pdf/pdfTheme';

const OCCUPANCY_STATE_LABEL: Record<string, string> = {
  underbooked: 'Underbooked',
  building: 'Building',
  strong: 'Strong occupancy',
  fully_booked: 'Fully booked',
};

const BALANCE_STATE_LABEL: Record<string, string> = {
  clear: 'Balances clear',
  attention_needed: 'Balances need attention',
  at_risk: 'Balances at risk',
};

function pct(n: number | null): string {
  if (n === null) return '';
  return ` (${n > 0 ? '+' : ''}${n.toFixed(1)}%)`;
}

function accentForChange(n: number | null): 'positive' | 'negative' | 'neutral' {
  if (n === null || n === 0) return 'neutral';
  return n > 0 ? 'positive' : 'negative';
}

function buildKpiItems(bundle: AnalyticsBundle): PdfKpiItem[] {
  const k = bundle.kpis;
  // Rate KPIs from analytics-summary are already 0–100 (not 0–1 fractions).
  return [
    {
      label: 'Occupancy',
      value: `${Math.round(k.occupancyRate.value)}%${pct(k.occupancyRate.changePctVsPrior)}`,
      accent: accentForChange(k.occupancyRate.changePctVsPrior),
    },
    {
      label: 'ADR',
      value: `${pdfMoney(k.adr.value)}${pct(k.adr.changePctVsPrior)}`,
      accent: accentForChange(k.adr.changePctVsPrior),
    },
    {
      label: 'RevPAR',
      value: `${pdfMoney(k.revpar.value)}${pct(k.revpar.changePctVsPrior)}`,
      accent: accentForChange(k.revpar.changePctVsPrior),
    },
    {
      label: 'Gross revenue',
      value: `${pdfMoney(k.grossRevenue.value)}${pct(k.grossRevenue.changePctVsPrior)}`,
      accent: accentForChange(k.grossRevenue.changePctVsPrior),
    },
    {
      label: 'Net profit',
      value: `${pdfMoney(k.netProfit.value)}${pct(k.netProfit.changePctVsPrior)}`,
      accent: accentForChange(k.netProfit.changePctVsPrior),
    },
    { label: 'Reservations', value: String(Math.round(k.reservations.value)) },
    { label: 'Avg lead time', value: `${Math.round(k.avgLeadTimeDays.value)} days` },
    {
      label: 'Cancellation rate',
      value: `${Math.round(k.cancellationRate.value)}%`,
      accent: k.cancellationRate.value > 0 ? 'negative' : 'neutral',
    },
    { label: 'Avg rating', value: k.avgRating.value > 0 ? k.avgRating.value.toFixed(1) : '-' },
    { label: 'Repeat guests', value: `${Math.round(k.repeatGuestRate.value)}%` },
    { label: 'Avg response time', value: `${Math.round(k.avgResponseMinutes.value)} min` },
    { label: '24h response rate', value: `${Math.round(k.responseWithin24hRate.value)}%` },
  ];
}

function appendStateSection(doc: jsPDF, y: number, bundle: AnalyticsBundle): number {
  y = drawSectionEyebrow(
    doc,
    y,
    'Current state',
    'Forward-looking assessment, not a lagging metric'
  );
  const lines: string[] = [
    `Occupancy (next 30 days): ${OCCUPANCY_STATE_LABEL[bundle.stateAssessment.forwardOccupancyState30d] ?? bundle.stateAssessment.forwardOccupancyState30d}.`,
    `Occupancy (next 60 days): ${OCCUPANCY_STATE_LABEL[bundle.stateAssessment.forwardOccupancyState60d] ?? bundle.stateAssessment.forwardOccupancyState60d}.`,
  ];
  if (bundle.stateAssessment.balanceCollectionState !== 'clear') {
    lines.push(
      `${BALANCE_STATE_LABEL[bundle.stateAssessment.balanceCollectionState]}: ${bundle.stateAssessment.unpaidBalanceUpcomingCount} upcoming booking(s) with ${pdfMoney(bundle.stateAssessment.unpaidBalanceUpcomingTotal)} outstanding in the next 14 days.`
    );
  } else {
    lines.push('Balances: clear — no upcoming bookings with unpaid balances at risk.');
  }
  return drawBulletNotes(doc, y, lines);
}

function appendAiReviewSection(doc: jsPDF, y: number, review: AnalyticsAiReviewRecord): number {
  y = ensurePageSpace(doc, y, 60);
  y = drawSectionEyebrow(doc, y, 'AI Performance Review', review.headline);

  y = drawHeroMetric(
    doc,
    y,
    'Score',
    `${review.score} / 100`,
    review.score >= 70
      ? PDF_COLORS.success
      : review.score >= 40
        ? PDF_COLORS.warning
        : PDF_COLORS.destructive,
    review.score_delta !== null
      ? `${review.score_delta > 0 ? '+' : ''}${review.score_delta} vs previous review`
      : undefined
  );

  if (review.payload.strengths.length > 0) {
    y = drawSectionEyebrow(doc, y, 'Working well');
    y = drawBulletNotes(
      doc,
      y,
      review.payload.strengths.map((s) => (s.evidence ? `${s.title} — ${s.evidence}` : s.title))
    );
  }

  if (review.payload.improvements.length > 0) {
    y = ensurePageSpace(doc, y, 40);
    y = drawSectionEyebrow(doc, y, 'To improve');
    y = drawBulletNotes(
      doc,
      y,
      review.payload.improvements.map((item) => {
        const detail = item.action ?? item.why ?? item.evidence;
        return detail ? `${item.title} — ${detail}` : item.title;
      })
    );
  }

  if (review.payload.avoid.length > 0) {
    y = ensurePageSpace(doc, y, 40);
    y = drawSectionEyebrow(doc, y, 'Avoid');
    y = drawBulletNotes(
      doc,
      y,
      review.payload.avoid.map((item) => (item.why ? `${item.title} — ${item.why}` : item.title))
    );
  }

  return y;
}

function appendPlaybookSection(
  doc: jsPDF,
  y: number,
  articles: AnalyticsPlaybookArticle[]
): number {
  if (articles.length === 0) return y;
  y = ensurePageSpace(doc, y, 40);
  y = drawSectionEyebrow(
    doc,
    y,
    'Improvement Playbook',
    'Matched to this property’s current numbers'
  );
  return drawBulletNotes(
    doc,
    y,
    articles.map((a) => `${a.title} (${a.category})`)
  );
}

function appendDistributionsSection(doc: jsPDF, y: number, bundle: AnalyticsBundle): number {
  const tableW = contentWidth(doc);
  y = ensurePageSpace(doc, y, 60);
  y = drawSectionEyebrow(doc, y, 'Channel mix & guest origins');

  const topChannels = [...bundle.distributions.channelMix]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const topOrigins = collapseTopGuestOrigins(bundle.distributions.guestOrigins);
  const rowCount = Math.max(topChannels.length, topOrigins.length);
  const rows: string[][] = [];
  for (let i = 0; i < rowCount; i += 1) {
    const ch = topChannels[i];
    const origin = topOrigins[i];
    rows.push([
      ch ? `${ch.channel} (${ch.count})` : '',
      origin ? `${origin.origin} — ${origin.pct}%` : '',
    ]);
  }

  if (rows.length === 0) return y;

  autoTable(doc, {
    ...baseAutoTableOptions(tableW),
    startY: y,
    head: [['Booking channel', 'Guest origin']],
    body: rows,
    columnStyles: {
      0: { cellWidth: tableW * 0.5 },
      1: { cellWidth: tableW * 0.5 },
    },
  });

  return lastTableY(doc, y) + 10;
}

export type AnalyticsPdfPayload = {
  bundle: AnalyticsBundle;
  aiReview: AnalyticsAiReviewRecord | null;
  /** Human-readable label for the selected date range (e.g. "This month"). */
  periodLabel?: string | null;
  scopeLabel?: string | null;
  brandColor?: string | null;
};

async function buildAnalyticsReportPdf(payload: AnalyticsPdfPayload): Promise<jsPDF> {
  const { bundle } = payload;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  beginPdfTheme(payload.brandColor);
  await registerPdfFonts(doc);
  paintPageBackground(doc);

  let y = drawReportHeader(
    doc,
    buildPdfReportHeaderOptions(
      'Analytics report',
      payload.scopeLabel,
      `${bundle.period.from} – ${bundle.period.to}${payload.periodLabel ? ` (${payload.periodLabel})` : ''}`
    )
  );

  y = appendStateSection(doc, y, bundle);
  y = advanceSectionGap(y);

  y = drawSectionEyebrow(doc, y, 'Key metrics', 'vs prior period');
  y += 2;
  y = drawKpiGrid(doc, y, buildKpiItems(bundle));

  if (bundle.benchmark.available) {
    y = advanceSectionGap(y);
    y = drawSectionEyebrow(doc, y, 'Vs Kame median');
    const lines = [
      `Occupancy: median ${bundle.benchmark.medianOccupancyRate}% across ${bundle.benchmark.sampleSize} other active Pro listings this period${bundle.benchmark.occupancyPercentile !== null ? ` — this property is at the ${bundle.benchmark.occupancyPercentile}th percentile` : ''}.`,
    ];
    if (bundle.benchmark.medianAdr !== null) {
      lines.push(
        `ADR: median ${pdfMoney(bundle.benchmark.medianAdr)}${bundle.benchmark.adrPercentile !== null ? ` — this property is at the ${bundle.benchmark.adrPercentile}th percentile` : ''}.`
      );
    }
    y = drawBulletNotes(doc, y, lines);
  }

  y = advanceSectionGap(y);
  y = appendDistributionsSection(doc, y, bundle);

  if (payload.aiReview) {
    y = advanceSectionGap(y);
    y = appendAiReviewSection(doc, y, payload.aiReview);
  }

  if (bundle.playbook.length > 0) {
    y = advanceSectionGap(y);
    appendPlaybookSection(doc, y, bundle.playbook);
  }

  addPageFooter(doc, 'Analytics', payload.scopeLabel);
  return doc;
}

export async function downloadAnalyticsReportPdf(payload: AnalyticsPdfPayload): Promise<void> {
  const doc = await buildAnalyticsReportPdf(payload);
  doc.save(`kame-analytics_${payload.bundle.period.from}_${payload.bundle.period.to}.pdf`);
}
