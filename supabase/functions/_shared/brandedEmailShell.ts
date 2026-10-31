/**
 * Branded email shell for standalone transactional mail (non–property-template keys).
 * Uses the same `fragments/configurable-template-send.html` card as live property sends.
 */

import { resolveAppSettings } from './appSettings.ts';
import {
  escapeHtml,
  loadEmailTemplate,
  replacePlaceholders,
  withEmailShellStyleVars,
} from './renderEmailHtml.ts';
import { PLATFORM_BRAND_NAME, resolvePublicBrandName } from './platformBrand.ts';

async function emailHeaderLogoHtml(propertyId?: string | null, logoAlt?: string): Promise<string> {
  const settings = await resolveAppSettings(propertyId);
  const frag = await loadEmailTemplate('fragments/email-header-logo');
  return replacePlaceholders(
    frag,
    withEmailShellStyleVars(
      {
        logoUrl: escapeHtml(settings.emailLogoUrl),
        logoAlt: escapeHtml(logoAlt ?? 'Property'),
      },
      settings.brandColor
    )
  );
}

/** Primary CTA button matching the branded email shell. */
export function buildEmailCtaHtml(label: string, url: string, brandColor?: string | null): string {
  if (!url.trim()) return '';
  const ctaStyle = withEmailShellStyleVars({}, brandColor).emailShellCtaBtnStyle;
  return `<div class="cta-wrap" style="margin:28px 0 8px 0;text-align:center;"><a class="cta-btn" style="${ctaStyle}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></div>`;
}

/**
 * Wrap body HTML in the shared email shell (accent bar, logo, brand micro, card, legal footer).
 */
export async function renderBrandedEmailShell(input: {
  brandName: string;
  /** Subtitle under brand micro (property / listing / org line). */
  unitLabel?: string;
  emailTitle: string;
  /** Trusted HTML body (caller escapes user-controlled text). */
  bodyHtml: string;
  brandColor?: string | null;
  propertyId?: string | null;
  dateLineBlock?: string;
}): Promise<string> {
  const brandName = resolvePublicBrandName(input.brandName) || PLATFORM_BRAND_NAME || 'Property';
  const emailHeaderLogo = await emailHeaderLogoHtml(input.propertyId, brandName);
  const shell = await loadEmailTemplate('fragments/configurable-template-send');
  const legalFooter = brandName ? `© ${brandName}. All rights reserved.` : '© All rights reserved.';

  return replacePlaceholders(
    shell,
    withEmailShellStyleVars(
      {
        emailHeaderLogo,
        brandName: escapeHtml(brandName),
        unitLabel: escapeHtml(input.unitLabel?.trim() || brandName),
        emailTitle: escapeHtml(input.emailTitle.trim() || 'Email'),
        dateLineBlock: input.dateLineBlock ?? '',
        bodyContent: input.bodyHtml,
        legalFooter: escapeHtml(legalFooter),
      },
      input.brandColor
    )
  );
}
