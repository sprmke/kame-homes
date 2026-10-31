/**
 * Render property template previews — uses the same send shell + renderer as live emails.
 */

import { resolveAppSettings } from './appSettings.ts';
import { buildGuestFacingPlaceholderVars, loadGuestFacingContactInfo } from './guestContactInfo.ts';
import { loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import {
  renderPropertyTemplateSendEmail,
  type PropertyEmailTemplateKey,
} from './propertyTemplateEmail.ts';
import { buildSampleDynamicSections } from './propertyTemplateEmailSections.ts';
import { normalizeBlockLevelPlaceholdersInHtml } from './normalizeBlockLevelPlaceholders.ts';
import { normalizeEmailCalloutPlaceholders } from './normalizeEmailCalloutPlaceholders.ts';
import { escapeHtml } from './renderEmailHtml.ts';
import { getBuiltinPropertyTemplate, type PropertyTemplateCategory } from './propertyTemplates.ts';
import { PROPERTY_TEMPLATE_SAMPLE_VARS } from './propertyTemplatePlaceholders.ts';

export async function renderPropertyTemplatePreview(input: {
  propertyId: string;
  templateKey: string;
  category: PropertyTemplateCategory;
  content: string;
  name?: string;
}): Promise<{ html: string; mode: 'standard' | 'email-shell' }> {
  if (input.category === 'standard') {
    let resolvedContent = input.content;
    for (const [key, value] of Object.entries(PROPERTY_TEMPLATE_SAMPLE_VARS)) {
      resolvedContent = resolvedContent.split(`{{${key}}}`).join(value);
    }
    return {
      mode: 'standard',
      html: `<!doctype html><html><head><meta charset="utf-8"/><style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;color:#333;line-height:1.65;max-width:720px;margin:0 auto;font-size:15px}
        h1{font-size:1.875rem;font-weight:700;margin:1.5rem 0 .5rem}h2{font-size:1.5rem;font-weight:600;margin:1.25rem 0 .5rem}h3{font-size:1.25rem;font-weight:600;margin:1rem 0 .5rem}
        p{margin:0 0 16px}ul,ol{margin:0 0 16px;padding-left:1.5rem}ul{list-style:disc}ol{list-style:decimal}li{display:list-item;margin:.25rem 0}
        img{display:block;max-width:100%;height:auto;border-radius:.5rem;margin:1rem 0}
        table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
        td,th{border:1px solid #e2e8f0;padding:10px 12px;text-align:left;vertical-align:top}
      </style></head><body>${resolvedContent}</body></html>`,
    };
  }

  const settings = await resolveAppSettings(input.propertyId);
  const branding = await loadPropertyEmailBranding(input.propertyId);
  const guestContact = await loadGuestFacingContactInfo(input.propertyId, settings);
  const builtin = getBuiltinPropertyTemplate(input.templateKey);
  const dynamicSections = buildSampleDynamicSections({
    templateKey: input.templateKey,
    settings,
    branding,
    guestContact,
  });

  const placeholderVars: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(PROPERTY_TEMPLATE_SAMPLE_VARS).map(([key, value]) => [key, escapeHtml(value)])
    ),
    tower_and_unit_number: escapeHtml(branding.unitLabel),
    unit_number: escapeHtml(branding.unitLabel),
    property_name: escapeHtml(branding.propertyName),
    ...buildGuestFacingPlaceholderVars(guestContact),
    ...dynamicSections,
  };

  const previewContent = normalizeEmailCalloutPlaceholders(
    normalizeBlockLevelPlaceholdersInHtml(input.content),
    input.templateKey,
    { ensureMissing: true }
  );

  const html = await renderPropertyTemplateSendEmail({
    propertyId: input.propertyId,
    templateKey: input.templateKey as PropertyEmailTemplateKey,
    emailTitle: input.name?.trim() || builtin?.label || 'Email preview',
    placeholderVars,
    branding,
    contentOverride: previewContent,
  });

  return { mode: 'email-shell', html };
}
