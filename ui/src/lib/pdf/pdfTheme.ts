/** Design tokens mirrored from `ui/src/index.css` (`:root` light theme). Print-first. */

import { DEFAULT_ORG_BRAND_COLOR, resolveOrgBrandHex } from '@/lib/theme/brandColor';
import { parseHexRgb, rgbToHsl } from '@/lib/theme/colorConvert';

function hslToRgb(h: number, sPct: number, lPct: number): [number, number, number] {
  const s = sPct / 100;
  const l = lPct / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbFromHsl(h: number, s: number, l: number): [number, number, number] {
  return hslToRgb(h, s, l);
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  return parseHexRgb(hex);
}

export const PDF_FONT = 'PJS';

export const PDF_LAYOUT = {
  margin: 14,
  cardRadius: 3.5,
  contentRadius: 3.5,
  afterHeaderCard: 10,
  metaLine: 3.8,
  beforeBlock: 10,
  afterBlock: 14,
  afterSectionTitle: 8,
  sectionGap: 16,
  sectionLead: 12,
  kpiGap: 3,
  kpiRowH: 20,
} as const;

export const PDF_TYPE = {
  overline: 7,
  caption: 7.5,
  label: 7,
  body: 9,
  table: 8,
  data: 11,
  section: 13,
  title: 15,
  hero: 20,
} as const;

export type PdfRgb = [number, number, number];

export type PdfColorPalette = {
  pageBg: PdfRgb;
  card: PdfRgb;
  border: PdfRgb;
  separator: PdfRgb;
  foreground: PdfRgb;
  muted: PdfRgb;
  primary: PdfRgb;
  primaryDark: PdfRgb;
  primaryFg: PdfRgb;
  primarySubtle: PdfRgb;
  secondary: PdfRgb;
  success: PdfRgb;
  warning: PdfRgb;
  destructive: PdfRgb;
  shadow: PdfRgb;
  tableHeadBg: PdfRgb;
  tableHeadText: PdfRgb;
  tableStripe: PdfRgb;
  tableFoot: PdfRgb;
  emptyFill: PdfRgb;
};

function brandPaletteFromHex(
  hex: string
): Pick<PdfColorPalette, 'primary' | 'primaryDark' | 'primarySubtle'> {
  const parsed = parseHex(resolveOrgBrandHex(hex));
  const fallback = parseHex(DEFAULT_ORG_BRAND_COLOR)!;
  const { r, g, b } = parsed ?? fallback;
  const { h, s, l } = rgbToHsl(r, g, b);
  const sat = Math.max(35, Math.min(s, 85));
  return {
    primary: [r, g, b],
    primaryDark: rgbFromHsl(h, sat, Math.max(18, Math.min(l - 10, 32))),
    primarySubtle: rgbFromHsl(h, Math.min(sat, 28), 97),
  };
}

function buildPalette(brandHex?: string | null): PdfColorPalette {
  const brand = brandPaletteFromHex(brandHex ?? DEFAULT_ORG_BRAND_COLOR);
  return {
    pageBg: rgbFromHsl(220, 18, 97),
    card: [255, 255, 255],
    border: rgbFromHsl(220, 13, 91),
    separator: rgbFromHsl(220, 13, 88),
    foreground: rgbFromHsl(224, 71, 4),
    muted: rgbFromHsl(220, 9, 46),
    primary: brand.primary,
    primaryDark: brand.primaryDark,
    primaryFg: [255, 255, 255],
    primarySubtle: brand.primarySubtle,
    secondary: rgbFromHsl(220, 14, 96),
    /** Semantic positive — teal, matches app status "green" tone (not brand color). */
    success: [20, 184, 166],
    warning: rgbFromHsl(38, 92, 44),
    destructive: rgbFromHsl(0, 72, 48),
    shadow: rgbFromHsl(224, 40, 88),
    tableHeadBg: rgbFromHsl(220, 14, 97),
    tableHeadText: rgbFromHsl(224, 45, 18),
    tableStripe: rgbFromHsl(220, 12, 99),
    tableFoot: rgbFromHsl(220, 14, 96),
    emptyFill: rgbFromHsl(220, 12, 97),
  };
}

/** Mutable active palette — set via `beginPdfTheme` at the start of each export. */
export const PDF_COLORS: PdfColorPalette = buildPalette(DEFAULT_ORG_BRAND_COLOR);

/** Apply property/org brand hex for this PDF generation pass. */
export function beginPdfTheme(brandHex?: string | null): void {
  const next = buildPalette(brandHex);
  Object.assign(PDF_COLORS, next);
}

export function setPdfFill(
  doc: import('jspdf').jsPDF,
  color: readonly [number, number, number]
): void {
  doc.setFillColor(color[0], color[1], color[2]);
}

export function setPdfDraw(
  doc: import('jspdf').jsPDF,
  color: readonly [number, number, number]
): void {
  doc.setDrawColor(color[0], color[1], color[2]);
}

export function setPdfText(
  doc: import('jspdf').jsPDF,
  color: readonly [number, number, number]
): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

export function drawCard(
  doc: import('jspdf').jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  options?: { fill?: readonly [number, number, number]; border?: boolean }
): void {
  setPdfFill(doc, options?.fill ?? PDF_COLORS.card);
  if (options?.border === false) {
    doc.roundedRect(x, y, w, h, r, r, 'F');
    return;
  }
  setPdfDraw(doc, PDF_COLORS.border);
  doc.setLineWidth(0.18);
  doc.roundedRect(x, y, w, h, r, r, 'FD');
}
