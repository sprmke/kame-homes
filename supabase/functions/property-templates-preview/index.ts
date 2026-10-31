/**
 * property-templates-preview — Admin POST to render template HTML preview.
 * Auth: verifyAdminJwt
 */

import { renderPropertyTemplatePreview } from '../_shared/propertyTemplatePreview.ts';
import type { PropertyTemplateCategory } from '../_shared/propertyTemplates.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { validateTemplateContent } from '../_shared/propertyTemplates.ts';

function parseCategory(value: unknown): PropertyTemplateCategory | null {
  if (value === 'standard' || value === 'email' || value === 'custom') {
    return value;
  }
  return null;
}

serveAuthenticated('property-templates-preview', async (req) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const { property } = await resolveScopedPropertyAccess(req, 'templates:view');
  const propertyId = property.id;
  const body = await readJsonBody(req);

  const templateKey = typeof body.templateKey === 'string' ? body.templateKey.trim() : '';
  const content = typeof body.content === 'string' ? body.content : '';
  const category = parseCategory(body.category);
  const name = typeof body.name === 'string' ? body.name : undefined;

  if (!templateKey) return jsonError(req, 'templateKey is required', 400);
  if (!category) return jsonError(req, 'category is required', 400);

  const contentErr = validateTemplateContent(content);
  if (contentErr) return jsonError(req, contentErr, 400);

  const preview = await renderPropertyTemplatePreview({
    propertyId,
    templateKey,
    category,
    content,
    name,
  });

  return jsonSuccess(req, preview);
});
