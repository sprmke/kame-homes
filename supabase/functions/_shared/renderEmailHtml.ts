/**
 * Email HTML helpers: escape user-controlled text and replace {{placeholders}}
 * in template files under ./email-templates/*.html
 */

import { resolveEmailOnPrimaryHex, resolveEmailPrimaryHex } from './emailBrandColor.ts';
import { DEFAULT_ORG_BRAND_COLOR } from './orgSettingsValidation.ts';

export {
  resolveEmailOnPrimaryHex,
  resolveEmailPrimaryHex,
  resolveEmailReadableOnWhiteHex,
} from './emailBrandColor.ts';

/** Public absolute URL for `<img src>` (same asset as `ui/public/images/logo.png` on the live site). */
export const DEFAULT_EMAIL_LOGO_URL = 'https://kamehomes.space/images/logo.png';

const templateCache = new Map<string, string>();

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!match) return null;
  const raw = match[1];
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function toHexColor({ r, g, b }: { r: number; g: number; b: number }): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Lighten a hex color toward white (amount 0–1). */
export function lightenHexColor(hex: string, amount: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const t = Math.max(0, Math.min(1, amount));
  return toHexColor({
    r: rgb.r + (255 - rgb.r) * t,
    g: rgb.g + (255 - rgb.g) * t,
    b: rgb.b + (255 - rgb.b) * t,
  });
}

/** Inline style for guest-facing social links in email copy. */
export function emailSocialLinkStyle(brandColor?: string | null): string {
  return `color:${resolveEmailPrimaryHex(brandColor)};font-weight:600;text-decoration:underline;`;
}

/** Escape text for HTML body contexts (attributes should use stricter encoding if added). */
export function escapeHtml(s: string | number | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Plain-text block for parking broadcast — shown in a selectable box (no JS in email). */
export function buildParkingBroadcastCopyText(input: {
  unit: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  carBrandModel: string;
  carColor: string;
  carPlate: string;
}): string {
  return [
    `Unit: ${input.unit}`,
    `Guest Name: ${input.guestName}`,
    `Check-in: ${input.checkInDate}`,
    `Check-out: ${input.checkOutDate}`,
    `Vehicle: ${input.carBrandModel} (${input.carColor})`,
    `Plate: ${input.carPlate}`,
  ].join('\n');
}

/**
 * Replace `{{key}}` placeholders. Values are inserted as-is — caller must
 * pass `escapeHtml(...)` for guest-supplied fields, or trusted HTML fragments.
 */
export function replacePlaceholders(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

/**
 * Critical layout/typography mirrored as inline `style` for clients (notably
 * Gmail web) that drop or ignore class rules from `<head>`. Keep visually in
 * sync with `.email-outer` … `.content-pad` / `.h1-title` in the HTML templates.
 */
const EMAIL_SHELL_STYLE_VARS: Record<string, string> = {
  emailShellBodyStyle:
    'margin:0 !important;padding:0 !important;-webkit-text-size-adjust:100%;background-color:#f3f4f6;',
  emailShellTableOuterStyle:
    'width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background-color:#f3f4f6;',
  emailShellTdShellPadStyle: 'padding:22px 12px 30px 12px;',
  emailShellTableWrapperStyle:
    'width:100%;max-width:600px;margin:0 auto;border-collapse:separate;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;',
  emailShellTdAccentStyle: `height:5px;line-height:5px;font-size:0;background-color:${DEFAULT_ORG_BRAND_COLOR};`,
  emailShellTdCardShellStyle: 'padding:0;vertical-align:top;',
  emailShellTableCardStyle:
    'width:100%;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:2px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:none;',
  emailShellTdContentPadStyle:
    "padding:28px 24px 30px 24px;text-align:left;color:#333333;font-size:15px;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellTdLegalFooterStyle:
    "padding:22px 16px 0 16px;text-align:center;font-size:12px;line-height:1.55;color:#666666;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellH1Style:
    "margin:0 0 8px 0;font-size:22px;font-weight:700;line-height:1.3;letter-spacing:-0.02em;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellH1LgStyle:
    "margin:20px 0 12px 0;font-size:24px;font-weight:700;line-height:1.25;letter-spacing:-0.02em;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellDateLineStyle:
    "margin:0 0 24px 0;font-size:14px;line-height:1.5;color:#666666;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellTaglineLooserStyle:
    "margin:0 0 26px 0;font-size:15px;line-height:1.5;color:#666666;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellBodyCopyStyle:
    "color:#333333;font-size:16px;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellBrandMicroStyle:
    "font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#666666;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellTextSubheadingStyle:
    "font-size:15px;font-weight:700;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellTextArrowStyle: 'color:#94a3b8;',
  emailShellCtaBtnStyle: `display:inline-block;padding:14px 28px;background-color:${resolveEmailPrimaryHex(null)} !important;color:${resolveEmailOnPrimaryHex(null)} !important;text-decoration:none;border-radius:14px;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;`,
  emailStepCardOuterStyle:
    'width:100%;border-collapse:separate;border-spacing:0;background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:16px;',
  emailStepCardInnerWrapStyle: 'padding:0;border-radius:16px;',
  emailStepCardInnerStyle:
    'width:100%;border-collapse:separate;border-spacing:0;background-color:#f1f5f9;border-radius:16px;overflow:hidden;',
  emailStepNumCellStyle: `width:68px;min-width:68px;padding:14px 10px 14px 12px;border-right:1px solid #e2e8f0;text-align:center;vertical-align:middle;background-color:#f1f5f9;color:${resolveEmailPrimaryHex(null)};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:32px;font-weight:700;line-height:1;`,
  emailStepNumTextStyle: `font-size:32px;font-weight:700;line-height:1;color:${resolveEmailPrimaryHex(null)};display:inline-block;`,
  emailStepBodyCellStyle:
    "padding:14px 14px 14px 12px;vertical-align:middle;background-color:#f1f5f9;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;",
  emailStepBodyPStyle:
    "margin:0;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;",
  emailAttachListWrapStyle:
    'width:100%;border-collapse:separate;border-spacing:0;background-color:transparent;',
  emailAttachListCellStyle: `padding:18px 20px;background-color:#f1f5f9;border:1px solid #e2e8f0;border-left:4px solid ${lightenHexColor(resolveEmailPrimaryHex(null), 0.55)};border-radius:16px;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;`,
  emailLogoWrapTdStyle: 'padding:0 0 22px 0;text-align:center;',
  emailLogoFrameTableStyle:
    'margin:0 auto;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;',
  emailLogoFrameTdStyle:
    'width:80px;height:80px;max-width:80px;overflow:hidden;border-radius:12px;line-height:0;font-size:0;box-shadow:0 4px 14px rgba(15,23,42,0.08);',
  emailLogoImgStyle:
    'display:block;width:80px;height:80px;border:0;outline:none;text-decoration:none;object-fit:cover;object-position:center;',
};

function buildBrandedEmailShellStyleVars(brandColorHex?: string | null): Record<string, string> {
  const primary = resolveEmailPrimaryHex(brandColorHex);
  const onPrimary = resolveEmailOnPrimaryHex(brandColorHex);
  const attachAccent = lightenHexColor(primary, 0.55);
  return {
    emailShellPrimaryHex: primary,
    emailShellTdAccentStyle: `height:5px;line-height:5px;font-size:0;background-color:${primary};`,
    emailShellCtaBtnStyle: `display:inline-block;padding:14px 28px;background-color:${primary} !important;color:${onPrimary} !important;text-decoration:none;border-radius:14px;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;`,
    emailStepNumCellStyle: `width:68px;min-width:68px;padding:14px 10px 14px 12px;border-right:1px solid #e2e8f0;text-align:center;vertical-align:middle;background-color:#f1f5f9;color:${primary};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:32px;font-weight:700;line-height:1;`,
    emailStepNumTextStyle: `font-size:32px;font-weight:700;line-height:1;color:${primary};display:inline-block;`,
    emailAttachListCellStyle: `padding:18px 20px;background-color:#f1f5f9;border:1px solid #e2e8f0;border-left:4px solid ${attachAccent};border-radius:16px;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;`,
  };
}

/** Merge Gmail-safe inline style keys after per-email placeholders. */
export function withEmailShellStyleVars(
  vars: Record<string, string>,
  brandColorHex?: string | null
): Record<string, string> {
  return {
    ...vars,
    ...EMAIL_SHELL_STYLE_VARS,
    ...buildBrandedEmailShellStyleVars(brandColorHex),
  };
}

const templateDir = new URL('./email-templates/', import.meta.url);

/**
 * Load a template once and cache. `name` is path without `.html`, e.g.
 * `gaf-request` or `fragments/test-warning-azure`.
 */
export async function loadEmailTemplate(name: string): Promise<string> {
  const hit = templateCache.get(name);
  if (hit !== undefined) return hit;
  const text = await Deno.readTextFile(new URL(`./${name}.html`, templateDir));
  templateCache.set(name, text);
  return text;
}
