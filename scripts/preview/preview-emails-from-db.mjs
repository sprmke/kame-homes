#!/usr/bin/env node
/**
 * Renders email HTML templates with real guest_submissions row data (or a demo
 * fallback) into supabase/functions/_shared/email-templates/_preview/
 *
 * Env (from supabase/.env.local or process.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   EMAIL_LOGO_URL (optional) — absolute URL for the Kame Homes logo in `<img src>`; default `https://kamehomes.space/images/logo.png`
 *
 * Run: bun run preview:emails:db
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TPL_DIR = path.join(
  ROOT,
  'supabase',
  'functions',
  '_shared',
  'email-templates',
);
const OUT_DIR = path.join(TPL_DIR, '_preview');

function loadDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function replacePlaceholders(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function buildParkingBroadcastCopyText(input) {
  return [
    `Unit: ${input.unit}`,
    `Guest Name: ${input.guestName}`,
    `Check-in: ${input.checkInDate}`,
    `Check-out: ${input.checkOutDate}`,
    `Vehicle: ${input.carBrandModel} (${input.carColor})`,
    `Plate: ${input.carPlate}`,
  ].join('\n');
}

/** Keep in sync with `supabase/functions/_shared/renderEmailHtml.ts` `EMAIL_SHELL_STYLE_VARS`. */
const EMAIL_SHELL_STYLE_VARS = {
  emailShellBodyStyle:
    'margin:0 !important;padding:0 !important;-webkit-text-size-adjust:100%;background-color:#f3f4f6;',
  emailShellTableOuterStyle:
    'width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background-color:#f3f4f6;',
  emailShellTdShellPadStyle: 'padding:32px 16px 44px 16px;',
  emailShellTableWrapperStyle:
    'width:100%;max-width:600px;margin:0 auto;border-collapse:separate;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;',
  emailShellTdAccentStyle:
    'height:5px;line-height:5px;font-size:0;background-color:#5f954c;',
  emailShellTdCardShellStyle: 'padding:0;vertical-align:top;',
  emailShellTableCardStyle:
    'width:100%;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:2px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:none;',
  emailShellTdContentPadStyle:
    "padding:36px 40px 40px 40px;text-align:left;color:#333333;font-size:15px;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
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
  emailShellCtaBtnStyle:
    "display:inline-block;padding:14px 28px;background-color:#2563eb;color:#ffffff !important;text-decoration:none;border-radius:14px;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailStepCardOuterStyle:
    'width:100%;border-collapse:separate;border-spacing:0;background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:16px;',
  emailStepCardInnerWrapStyle: 'padding:0;border-radius:16px;',
  emailStepCardInnerStyle:
    'width:100%;border-collapse:separate;border-spacing:0;background-color:#f1f5f9;border-radius:16px;overflow:hidden;',
  emailStepNumCellStyle:
    "width:68px;min-width:68px;padding:20px 14px;border-right:1px solid #e2e8f0;text-align:center;vertical-align:middle;background-color:#f1f5f9;color:#5f954c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:32px;font-weight:700;line-height:1;",
  emailStepNumTextStyle:
    'font-size:32px;font-weight:700;line-height:1;color:#5f954c;display:inline-block;',
  emailStepBodyCellStyle:
    "padding:18px 18px 18px 16px;vertical-align:middle;background-color:#f1f5f9;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;",
  emailStepBodyPStyle:
    "margin:0;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;",
  emailAttachListWrapStyle:
    'width:100%;border-collapse:separate;border-spacing:0;background-color:transparent;',
  emailAttachListCellStyle:
    "padding:18px 20px;background-color:#f1f5f9;border:1px solid #e2e8f0;border-left:4px solid #affd93;border-radius:16px;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;",
  emailLogoWrapTdStyle: 'padding:0 0 22px 0;text-align:center;',
  emailLogoFrameTableStyle:
    'margin:0 auto;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;',
  emailLogoFrameTdStyle:
    'width:80px;height:80px;max-width:80px;overflow:hidden;border-radius:12px;line-height:0;font-size:0;box-shadow:0 4px 14px rgba(15,23,42,0.08);',
  emailLogoImgStyle:
    'display:block;width:80px;height:80px;border:0;outline:none;text-decoration:none;object-fit:cover;object-position:center;',
};

const DEFAULT_ORG_BRAND_COLOR = '#24a88e';

function parseHexColor(hex) {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(String(hex ?? '').trim());
  if (!match) return null;
  const raw = match[1];
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function toHexColor({ r, g, b }) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

function lightenHexColor(hex, amount) {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const t = Math.max(0, Math.min(1, amount));
  return toHexColor({
    r: rgb.r + (255 - rgb.r) * t,
    g: rgb.g + (255 - rgb.g) * t,
    b: rgb.b + (255 - rgb.b) * t,
  });
}

function buildBrandedEmailShellStyleVars(brandColorHex) {
  const brand =
    typeof brandColorHex === 'string' && parseHexColor(brandColorHex)
      ? brandColorHex.trim()
      : DEFAULT_ORG_BRAND_COLOR;
  const attachAccent = lightenHexColor(brand, 0.55);
  return {
    emailShellTdAccentStyle: `height:5px;line-height:5px;font-size:0;background-color:${brand};`,
    emailShellCtaBtnStyle: `display:inline-block;padding:14px 28px;background-color:${brand};color:#ffffff !important;text-decoration:none;border-radius:14px;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;`,
    emailStepNumCellStyle: `width:68px;min-width:68px;padding:20px 14px;border-right:1px solid #e2e8f0;text-align:center;vertical-align:middle;background-color:#f1f5f9;color:${brand};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:32px;font-weight:700;line-height:1;`,
    emailStepNumTextStyle: `font-size:32px;font-weight:700;line-height:1;color:${brand};display:inline-block;`,
    emailAttachListCellStyle: `padding:18px 20px;background-color:#f1f5f9;border:1px solid #e2e8f0;border-left:4px solid ${attachAccent};border-radius:16px;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;`,
  };
}

function withEmailShellStyleVars(vars, brandColorHex) {
  return {
    ...vars,
    ...EMAIL_SHELL_STYLE_VARS,
    ...buildBrandedEmailShellStyleVars(brandColorHex),
  };
}

function loadTemplate(name) {
  const rel = name.endsWith('.html') ? name : `${name}.html`;
  return fs.readFileSync(path.join(TPL_DIR, rel), 'utf8');
}

function pesoFormat(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseTimeTo24h(timeStr) {
  const raw = String(timeStr ?? '').trim();
  if (!raw) return '';
  const ampm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2];
    const mer = ampm[3].toUpperCase();
    if (mer === 'AM' && h === 12) h = 0;
    else if (mer === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const hm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`;
  return '';
}

/** User-facing 12-hour time; DB stores 24h HH:mm. */
function formatTimeForDisplay(timeStr, fallback = '') {
  const hm24 = parseTimeTo24h(timeStr);
  if (!hm24) return fallback;
  const [hStr, m] = hm24.split(':');
  let h = Number(hStr);
  const mer = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${mer}`;
}

function formatDateForEmail(dateStr) {
  if (!dateStr) return '';

  const s = String(dateStr).trim();
  const mdy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  let d;
  if (mdy) {
    const [, m, day, y] = mdy;
    d = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  } else if (ymd) {
    const [, y, m, day] = ymd;
    d = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  } else {
    d = new Date(s);
  }

  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const DEFAULT_EMAIL_LOGO_URL = 'https://kamehomes.space/images/logo.png';

function buildEmailHeaderLogoHtml(logoUrl, logoAlt = 'Property') {
  const frag = loadTemplate('fragments/email-header-logo');
  return replacePlaceholders(
    frag,
    withEmailShellStyleVars({
      logoUrl: escapeHtml(logoUrl),
      logoAlt: escapeHtml(logoAlt),
    }),
  );
}

/**
 * The house-rules file is an HTML fragment (no head/styles). Wrap it so
 * browser preview matches how it appears inside ready-for-check-in.
 */
function wrapHouseRulesStandalonePreview(fragmentHtml, emailHeaderLogo) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Important reminders (preview)</title>
    <style type="text/css">
      body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: #f3f4f6 !important;
        -webkit-text-size-adjust: 100%;
        font-family:
          -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
          Arial, sans-serif;
      }
      table {
        border-collapse: collapse;
      }
      .shell-pad {
        padding: 32px 16px 44px;
      }
      .email-wrapper {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        border: 2px solid #e2e8f0;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
      }
      .content-pad {
        padding: 36px 40px 40px;
        color: #333333;
      }
      .section-label {
        margin: 0 0 14px 0;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #5f954c;
      }
      .section-label-mt-sm {
        margin: 28px 0 10px 0;
      }
      .hr-subtitle {
        margin: 0 0 14px 0;
        color: #666666;
        font-size: 14px;
        line-height: 1.5;
      }
      .data-table {
        width: 100%;
        table-layout: fixed;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        border-collapse: separate;
        border-spacing: 0;
        overflow: hidden;
        font-size: 14px;
      }
      .data-table tr:first-child td:first-child {
        border-top-left-radius: 16px;
      }
      .data-table tr:first-child td:last-child {
        border-top-right-radius: 16px;
      }
      .data-table tr:last-child td:first-child {
        border-bottom-left-radius: 16px;
      }
      .data-table tr:last-child td:last-child {
        border-bottom-right-radius: 16px;
      }
      .tbl-label {
        padding: 12px 16px;
        background-color: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        font-weight: 600;
        color: #475569;
        vertical-align: top;
        width: 31%;
      }
      .tbl-value {
        padding: 12px 16px;
        background-color: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        color: #333333;
        line-height: 1.55;
        vertical-align: top;
      }
      .text-strong {
        color: #111827;
        font-weight: 700;
      }
      .email-logo-wrap {
        padding: 0 0 22px 0;
        text-align: center;
      }
      .email-logo-frame {
        width: 80px;
        height: 80px;
        max-width: 80px;
        overflow: hidden;
        border-radius: 12px;
        line-height: 0;
        font-size: 0;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
      }
      .email-logo {
        display: block;
        width: 80px;
        height: 80px;
        border: 0;
        border-radius: 12px;
        object-fit: cover;
        object-position: center;
      }
      .brand-block {
        margin-bottom: 22px;
      }
      .brand-line {
        padding-bottom: 4px;
      }
      .brand-micro {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #666666;
      }
      .text-subheading {
        font-size: 15px;
        font-weight: 700;
        color: #333333;
      }
      .legal-footer {
        padding: 22px 16px 0;
        font-size: 12px;
        line-height: 1.55;
        color: #666666;
        text-align: center;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background-color: #0f172a !important;
        }
        .email-wrapper {
          background: #1e293b !important;
          border-color: #334155 !important;
        }
        .content-pad {
          color: #f1f5f9 !important;
        }
        .section-label {
          color: #affd93 !important;
        }
        .hr-subtitle {
          color: #94a3b8 !important;
        }
        .tbl-label,
        .tbl-value {
          background-color: #1e293b !important;
          border-bottom-color: #334155 !important;
          color: #e2e8f0 !important;
        }
        .text-strong {
          color: #f8fafc !important;
        }
        .brand-micro {
          color: #94a3b8 !important;
        }
        .text-subheading {
          color: #f1f5f9 !important;
        }
        .legal-footer {
          color: #cbd5e1 !important;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" class="shell-pad">
          <table role="presentation" class="email-wrapper" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td class="content-pad">
                ${emailHeaderLogo}
                <table role="presentation" class="brand-block" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="brand-line">
                      <span class="brand-micro">Kame Homes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span class="text-subheading">Monaco 2604</span>
                    </td>
                  </tr>
                </table>
                ${fragmentHtml}
              </td>
            </tr>
            <tr>
              <td align="center" class="legal-footer">
                &copy; Kame Homes. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/** Rich demo row when DB has no suitable booking (offline / empty DB). */
const DEMO_BOOKING = {
  id: 'demo-preview-id',
  guest_facebook_name: 'Alex Rivera (Demo)',
  guest_email: 'guest.demo@example.com',
  check_in_date: '06-15-2026',
  check_out_date: '06-18-2026',
  check_in_time: '2:00 PM',
  check_out_time: '12:00 PM',
  number_of_adults: 2,
  number_of_children: 1,
  tower_and_unit_number: 'Tower 1 · Unit 2604',
  owner_onsite_contact_person: 'Arianna Perez',
  owner_contact_number: '+63 917 000 0000',
  need_parking: true,
  car_brand_model: 'Toyota Fortuner',
  car_color: 'Pearl White',
  car_plate_number: 'ABC 1234',
  has_pets: true,
  pet_name: 'Milo',
  pet_type: 'Dog',
  pet_breed: 'Shih Tzu',
  pet_age: '3 years',
  pet_vaccination_date: '01-10-2026',
  booking_rate: 12500,
  down_payment: 5000,
  balance: 7500,
  security_deposit: 1500,
  parking_rate_guest: 500,
  pet_fee: 300,
  guest_additional_fee: 250,
  status: 'READY_FOR_CHECKIN',
};

function buildParkingPaymentRow(booking) {
  if (!booking.need_parking) return '';
  return `
    <tr class="fee-addon-row">
      <td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Guest parking fee</td>
      <td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.parking_rate_guest)}</td>
      <td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"><em class="italic-note">Non-refundable; no rescheduling</em></td>
    </tr>`;
}

function buildPetPaymentRow(booking) {
  if (!booking.has_pets) return '';
  return `
    <tr class="fee-addon-row">
      <td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Pet fee</td>
      <td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.pet_fee)}</td>
      <td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"></td>
    </tr>`;
}

function buildAdditionalFeeRow(booking) {
  const amt = Number(booking.guest_additional_fee) || 0;
  if (amt <= 0) return '';
  return `
    <tr class="fee-addon-row">
      <td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Additional fee</td>
      <td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(amt)}</td>
      <td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;">Early check-in, late check-out, surprise decor, etc.</td>
    </tr>`;
}

/** Computes total balance due at check-in for payment section visibility. */
function computeTotalDueAtCheckin(booking) {
  const bal =
    booking.balance != null
      ? Number(booking.balance)
      : (Number(booking.booking_rate) || 0) -
        (Number(booking.down_payment) || 0);
  const sec = Number(booking.security_deposit) || 0;
  const park = booking.need_parking
    ? Number(booking.parking_rate_guest) || 0
    : 0;
  const pet = booking.has_pets ? Number(booking.pet_fee) || 0 : 0;
  const addl = Number(booking.guest_additional_fee) || 0;
  return (Number.isFinite(bal) ? bal : 0) + sec + park + pet + addl;
}

function buildPaymentBreakdownSection(
  booking,
  balance,
  parkingPaymentRow,
  petPaymentRow,
  additionalFeeRow,
) {
  const totalBalanceDue = pesoFormat(computeTotalDueAtCheckin(booking));
  return `<p class="section-label section-label-mt" style="margin:28px 0 12px 0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5f954c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Payment breakdown</p>
<table role="presentation" class="data-table data-table-payment" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;table-layout:fixed;border:1px solid #e2e8f0;border-radius:16px;border-collapse:separate;border-spacing:0;overflow:hidden;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <colgroup><col width="28%"/><col width="22%"/><col width="50%"/></colgroup>
  <tr><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Booking rate</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.booking_rate)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"></td></tr>
  <tr><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Down payment paid</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.down_payment)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"></td></tr>
  <tr><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Booking rate balance</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(balance)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"></td></tr>
  <tr><td class="tbl-label" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;vertical-align:top;">Security deposit</td><td class="tbl-num" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:right;color:#333333;vertical-align:top;">${pesoFormat(booking.security_deposit)}</td><td class="tbl-note" style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;font-size:12px;color:#555555;line-height:1.45;vertical-align:top;"><em class="italic-note">Refundable after check-out</em></td></tr>
  ${parkingPaymentRow}${petPaymentRow}${additionalFeeRow}
  <tr class="tbl-row-emphasis fee-addon-row"><td class="tbl-label" style="padding:12px 16px;background-color:#fffbeb;border-bottom:none;font-weight:600;color:#78350f;vertical-align:top;">Total balance</td><td class="tbl-num" style="padding:12px 16px;background-color:#fffbeb;border-bottom:none;text-align:right;color:#b45309;font-weight:700;vertical-align:top;">${totalBalanceDue}</td><td class="tbl-note" style="padding:12px 16px;background-color:#fffbeb;border-bottom:none;font-size:12px;color:#92400e;line-height:1.45;vertical-align:top;"><em class="italic-note">Payable on or before check-in. Please pay via online or bank transfer.</em></td></tr>
</table>`;
}

function buildPaymentInstructionsSection(paymentSettings) {
  const provider = escapeHtml(
    (paymentSettings.paymentProvider || 'GCash').trim(),
  );
  const qrUrl = escapeHtml(paymentSettings.gcashQrImageUrl);
  const accountName = escapeHtml(paymentSettings.gcashName);
  const accountNumber = escapeHtml(paymentSettings.gcashNumber);
  const paymentCopy = escapeHtml(
    `Save and scan the QR code or send to the ${(paymentSettings.paymentProvider || 'GCash').trim()} account beside it to pay your total balance upon check-in.`,
  );

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin:22px 0 0 0;">
  <tr><td style="padding:0;vertical-align:top">
    <p class="section-label" style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5f954c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Total balance payment — ${provider}</p>
    <p class="gcash-payment-copy">${paymentCopy}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">
      <tr>
        <td align="left" valign="top" style="padding:0 16px 0 0;width:250px;vertical-align:top;"><img src="${qrUrl}" width="250" alt="${provider} QR code for payments" style="display:block;width:100%;max-width:250px;height:auto;border:1px solid #e2e8f0;border-radius:12px;"/></td>
        <td align="left" valign="middle" style="padding:0;vertical-align:middle">
          <p class="gcash-payment-label">Account name</p>
          <p class="gcash-payment-value gcash-payment-value-spaced">${accountName}</p>
          <p class="gcash-payment-label">Account Number</p>
          <p class="gcash-payment-value">${accountNumber}</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
}

function buildDocumentRemindersSection(booking) {
  const gafReminderHtml = `
    <table role="presentation" class="callout-outer callout-doc callout-doc--gaf" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 14px 0;">
      <tr>
        <td style="padding:18px 20px;background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #5f954c;border-radius:16px;color:#334155;font-size:14px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
          <span class="callout-title" style="display:block;margin-bottom:8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#5f954c;font-weight:700;">Guest Advise Form (GAF)</span>
          Your GAF has been approved. No need to print it! Simply present it at the guard house upon arrival and to the lobby receptionist during registration.
        </td>
      </tr>
    </table>`;

  const parkingReminderHtml = booking.need_parking
    ? `
    <table role="presentation" class="callout-outer callout-doc callout-doc--parking" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 14px 0;">
      <tr>
        <td style="padding:18px 20px;background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #5f954c;border-radius:16px;color:#334155;font-size:14px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
          <span class="callout-title" style="display:block;margin-bottom:8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#5f954c;font-weight:700;">Parking</span>
          Your parking slot is confirmed. The guest parking fee is <strong class="callout-strong" style="color:#1e293b;font-weight:700;">non-refundable</strong>, and once confirmed your parking dates <strong class="callout-strong" style="color:#1e293b;font-weight:700;">cannot be rescheduled</strong>.
        </td>
      </tr>
    </table>`
    : '';

  const petReminderHtml = booking.has_pets
    ? `
    <table role="presentation" class="callout-outer callout-doc callout-doc--pet" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 14px 0;">
      <tr>
        <td style="padding:18px 20px;background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #5f954c;border-radius:16px;color:#334155;font-size:14px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
          <span class="callout-title" style="display:block;margin-bottom:8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#5f954c;font-weight:700;">Pet</span>
          Your pet has been approved for this stay. Please keep your pet on a leash at all times and keep them within designated pet areas.
        </td>
      </tr>
    </table>`
    : '';

  return gafReminderHtml + parkingReminderHtml + petReminderHtml;
}

function gafBodyParagraphs(booking) {
  const u = escapeHtml(booking.tower_and_unit_number);
  const ci = escapeHtml(formatDateForEmail(booking.check_in_date));
  const co = escapeHtml(formatDateForEmail(booking.check_out_date));
  return `<p>Kindly review the Guest Advise Form (GAF) request for <strong>${u}</strong>, dated from <strong>${ci} to ${co}</strong>, for your approval.</p>`;
}

function petBodyParagraphs(booking) {
  const u = escapeHtml(booking.tower_and_unit_number);
  const ci = escapeHtml(formatDateForEmail(booking.check_in_date));
  const co = escapeHtml(formatDateForEmail(booking.check_out_date));
  return `<p>May we kindly request approval for our guest to bring a pet during their stay at <strong>${u}</strong> during their stay from <strong>${ci}</strong> to <strong>${co}</strong>.</p>`;
}

const URGENT_BLOCK = '';

const DEFAULT_GCASH_NAME = 'Arianna Perez';
const DEFAULT_GCASH_NUMBER = '0962 564 7541';
const DEFAULT_GCASH_QR_URL =
  'https://kamehomes.space/images/kame-home-gcash-qr-payment.jpg';

async function loadPaymentSettings(supabase) {
  const defaults = {
    gcashName: DEFAULT_GCASH_NAME,
    gcashNumber: DEFAULT_GCASH_NUMBER,
    paymentProvider: 'GCash',
    gcashQrImageUrl: DEFAULT_GCASH_QR_URL,
  };
  if (!supabase) return defaults;
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('gcash_name, gcash_number, gcash_qr_image_url, payment_provider, public_guest_app_origin')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return defaults;
    const origin = (data.public_guest_app_origin || 'https://kamehomes.space').replace(
      /\/+$/,
      '',
    );
    return {
      gcashName: (data.gcash_name || DEFAULT_GCASH_NAME).trim(),
      gcashNumber: (data.gcash_number || DEFAULT_GCASH_NUMBER).trim(),
      paymentProvider: (data.payment_provider || 'GCash').trim(),
      gcashQrImageUrl:
        (data.gcash_qr_image_url || `${origin}/images/kame-home-gcash-qr-payment.jpg`).trim(),
    };
  } catch {
    return defaults;
  }
}

async function pickBooking(supabase) {
  const base = () =>
    supabase
      .from('guest_submissions')
      .select('*')
      .neq('status', 'CANCELLED')
      .neq('status', 'canceled');

  let q = await base()
    .eq('has_pets', true)
    .eq('need_parking', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (q.error) throw q.error;
  if (q.data) return { row: q.data, label: 'has_pets + need_parking' };

  q = await base()
    .or('has_pets.eq.true,need_parking.eq.true')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (q.error) throw q.error;
  if (q.data) return { row: q.data, label: 'has_pets or need_parking' };

  q = await base()
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (q.error) throw q.error;
  if (q.data) return { row: q.data, label: 'latest non-cancelled' };

  return { row: null, label: null };
}

async function loadBrandColorForBooking(supabase, booking) {
  if (!supabase || !booking?.property_id) return DEFAULT_ORG_BRAND_COLOR;
  try {
    const { data: property } = await supabase
      .from('properties')
      .select('organization_id')
      .eq('id', booking.property_id)
      .maybeSingle();
    if (!property?.organization_id) return DEFAULT_ORG_BRAND_COLOR;
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', property.organization_id)
      .maybeSingle();
    const raw = org?.settings?.brandColor;
    if (typeof raw === 'string' && parseHexColor(raw)) return raw.trim();
  } catch {
    /* fall through */
  }
  return DEFAULT_ORG_BRAND_COLOR;
}

function renderAll(booking, meta, emailLogoUrl, paymentSettings, brandColor = DEFAULT_ORG_BRAND_COLOR) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shell = (vars) => withEmailShellStyleVars(vars, brandColor);

  const emailHeaderLogo = buildEmailHeaderLogoHtml(emailLogoUrl);
  const testWarning = '';
  const updateSuffix = '';

  const displayCheckInDate = formatDateForEmail(booking.check_in_date);
  const displayCheckOutDate = formatDateForEmail(booking.check_out_date);
  const displayPetVaccinationDate = formatDateForEmail(
    booking.pet_vaccination_date,
  );

  const gafTpl = loadTemplate('gaf-request');
  const gafHtml = replacePlaceholders(
    gafTpl,
    shell({
      emailHeaderLogo,
      testWarning,
      updateSuffix,
      urgentBlock: URGENT_BLOCK,
      checkInDate: escapeHtml(displayCheckInDate),
      checkOutDate: escapeHtml(displayCheckOutDate),
      bodyParagraphs: gafBodyParagraphs(booking),
    }),
  );
  fs.writeFileSync(path.join(OUT_DIR, 'gaf-request.html'), gafHtml, 'utf8');

  const petTpl = loadTemplate('pet-request');
  const petHtml = replacePlaceholders(
    petTpl,
    shell({
      emailHeaderLogo,
      testWarning,
      updateSuffix,
      urgentBlock: URGENT_BLOCK,
      checkInDate: escapeHtml(displayCheckInDate),
      checkOutDate: escapeHtml(displayCheckOutDate),
      bodyParagraphs: petBodyParagraphs(booking),
      petName: escapeHtml(booking.pet_name || 'N/A'),
      petType: escapeHtml(booking.pet_type || 'N/A'),
      petBreed: escapeHtml(booking.pet_breed || 'N/A'),
      petAge: escapeHtml(booking.pet_age || 'N/A'),
      petVaccinationDate: escapeHtml(displayPetVaccinationDate || 'N/A'),
    }),
  );
  fs.writeFileSync(path.join(OUT_DIR, 'pet-request.html'), petHtml, 'utf8');

  const ackTpl = loadTemplate('booking-acknowledgement');
  const ackHtml = replacePlaceholders(
    ackTpl,
    shell({
      emailHeaderLogo,
      testWarning,
      guestFacebookName: escapeHtml(booking.guest_facebook_name),
      towerAndUnitNumber: escapeHtml(booking.tower_and_unit_number),
      checkInDate: escapeHtml(displayCheckInDate),
      checkOutDate: escapeHtml(displayCheckOutDate),
    }),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'booking-acknowledgement.html'),
    ackHtml,
    'utf8',
  );

  const parkTpl = loadTemplate('parking-broadcast');
  const unitLabel = String(booking.tower_and_unit_number ?? '').trim() ||
    'Monaco 2604';
  const guestName = String(booking.primary_guest_name ?? '').trim() || 'N/A';
  const carBrandModel = String(booking.car_brand_model ?? '').trim() || 'N/A';
  const carColor = String(booking.car_color ?? '').trim() || 'N/A';
  const carPlate = String(booking.car_plate_number ?? '').trim() || 'N/A';
  const parkHtml = replacePlaceholders(
    parkTpl,
    shell({
      emailHeaderLogo,
      testWarning,
      checkInDate: escapeHtml(displayCheckInDate),
      checkOutDate: escapeHtml(displayCheckOutDate),
      towerAndUnitNumber: escapeHtml(booking.tower_and_unit_number),
      checkInTime: escapeHtml(
        formatTimeForDisplay(booking.check_in_time, '2:00 PM'),
      ),
      checkOutTime: escapeHtml(
        formatTimeForDisplay(booking.check_out_time, '11:00 AM'),
      ),
      carBrandModel: escapeHtml(carBrandModel),
      carColor: escapeHtml(carColor),
      carPlate: escapeHtml(carPlate),
      primaryGuestName: escapeHtml(guestName),
      bookingVehicleCopyText: escapeHtml(
        buildParkingBroadcastCopyText({
          unit: unitLabel,
          checkInDate: displayCheckInDate,
          checkOutDate: displayCheckOutDate,
          guestName,
          carBrandModel,
          carColor,
          carPlate,
        }),
      ),
    }),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'parking-broadcast.html'),
    parkHtml,
    'utf8',
  );

  const pax =
    (Number(booking.number_of_adults) || 0) +
    (Number(booking.number_of_children) || 0);
  const balance =
    booking.balance != null
      ? Number(booking.balance)
      : (Number(booking.booking_rate) || 0) -
        (Number(booking.down_payment) || 0);
  const displayCheckInTime = escapeHtml(
    formatTimeForDisplay(booking.check_in_time, '2:00 PM'),
  );
  const displayCheckOutTime = escapeHtml(
    formatTimeForDisplay(booking.check_out_time, '11:00 AM'),
  );

  const houseRulesTpl = loadTemplate('ready-for-checkin-house-rules');
  const houseRulesSection = replacePlaceholders(houseRulesTpl, {
    pax: String(pax),
    checkInTime: displayCheckInTime,
    checkOutTime: displayCheckOutTime,
    securityDepositFormatted: pesoFormat(booking.security_deposit),
  });
  const houseRulesPreviewHtml = wrapHouseRulesStandalonePreview(
    houseRulesSection,
    emailHeaderLogo,
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'ready-for-checkin-house-rules.html'),
    houseRulesPreviewHtml,
    'utf8',
  );

  const rfiTpl = loadTemplate('ready-for-checkin');
  const parkingPaymentRow = buildParkingPaymentRow(booking);
  const petPaymentRow = buildPetPaymentRow(booking);
  const additionalFeeRow = buildAdditionalFeeRow(booking);
  const totalDueAtCheckin = computeTotalDueAtCheckin(booking);
  const paymentBreakdownSection =
    totalDueAtCheckin > 0
      ? buildPaymentBreakdownSection(
          booking,
          balance,
          parkingPaymentRow,
          petPaymentRow,
          additionalFeeRow,
        )
      : '';
  const gcashPaymentSection =
    totalDueAtCheckin > 0
      ? buildPaymentInstructionsSection(paymentSettings)
      : '';
  const rfiHtml = replacePlaceholders(
    rfiTpl,
    shell({
      emailHeaderLogo,
      testWarning,
      checkInDate: escapeHtml(displayCheckInDate),
      checkOutDate: escapeHtml(displayCheckOutDate),
      guestFacebookName: escapeHtml(booking.guest_facebook_name),
      documentRemindersSection: buildDocumentRemindersSection(booking),
      pax: String(pax),
      towerAndUnitNumber: escapeHtml(booking.tower_and_unit_number),
      checkInTime: displayCheckInTime,
      checkOutTime: displayCheckOutTime,
      bookingRate: pesoFormat(booking.booking_rate),
      downPayment: pesoFormat(booking.down_payment),
      balance: pesoFormat(balance),
      securityDeposit: pesoFormat(booking.security_deposit),
      totalBalanceDue: pesoFormat(totalDueAtCheckin),
      parkingPaymentRow,
      petPaymentRow,
      additionalFeeRow,
      houseRulesSection,
      paymentBreakdownSection,
      gcashPaymentSection,
    }),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'ready-for-checkin.html'),
    rfiHtml,
    'utf8',
  );

  const metaPath = path.join(OUT_DIR, 'preview-meta.json');
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        source: meta.source,
        queryLabel: meta.queryLabel,
        bookingId: booking.id ?? null,
        guest_facebook_name: booking.guest_facebook_name,
        has_pets: booking.has_pets,
        need_parking: booking.need_parking,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function main() {
  const envPath = path.join(ROOT, 'supabase', '.env.local');
  const fileEnv = loadDotEnv(envPath);
  const emailLogoUrl = (
    process.env.EMAIL_LOGO_URL ||
    fileEnv.EMAIL_LOGO_URL ||
    DEFAULT_EMAIL_LOGO_URL
  ).trim();
  const url = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

  let booking;
  let meta = { source: 'demo', queryLabel: null };
  let paymentSettings = {
    gcashName: DEFAULT_GCASH_NAME,
    gcashNumber: DEFAULT_GCASH_NUMBER,
    paymentProvider: 'GCash',
    gcashQrImageUrl: DEFAULT_GCASH_QR_URL,
  };

  if (url && key) {
    const supabase = createClient(url, key);
    paymentSettings = await loadPaymentSettings(supabase);
    try {
      const { row, label } = await pickBooking(supabase);
      if (row) {
        booking = row;
        meta = { source: 'database', queryLabel: label };
        console.log(`Using guest_submissions row: ${booking.id} (${label})`);
      }
    } catch (e) {
      console.warn('Supabase query failed, using demo data:', e.message || e);
    }
  } else {
    console.warn(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — using built-in demo data.',
    );
    console.warn(`Expected in ${envPath} or process.env`);
  }

  if (!booking) {
    booking = { ...DEMO_BOOKING };
    console.log('Using built-in DEMO_BOOKING (no DB row).');
  }

  let brandColor = DEFAULT_ORG_BRAND_COLOR;
  if (url && key && booking?.property_id) {
    const supabase = createClient(url, key);
    brandColor = await loadBrandColorForBooking(supabase, booking);
  }

  renderAll(booking, meta, emailLogoUrl, paymentSettings, brandColor);
  console.log(`Wrote filled previews to ${path.relative(ROOT, OUT_DIR)}/`);
  console.log(
    'Open http://localhost:3334/ and use the "Filled from database" links (run npm run preview:emails:serve if the server is not up).',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
