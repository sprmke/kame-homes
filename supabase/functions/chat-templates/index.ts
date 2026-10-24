/**
 * chat-templates — read-only list of property templates a host can send in chat.
 * Requires `inbox:view` on the property (not `templates:view`), so any teammate
 * who can answer the guest inbox can pick a template. Email templates are never
 * returned. Parking inboxes have no templates module and get an empty list.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { serializePropertyTemplatesForAdmin } from '../_shared/propertyTemplates.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('chat-templates', async (req) => {
  if (req.method !== 'GET') return jsonError(req, 'Method not allowed', 405);

  const ctx = await resolveInboxAccess(req, 'view');
  if (!ctx.propertyId) return jsonSuccess(req, { templates: [] });

  const data = await serializePropertyTemplatesForAdmin(ctx.propertyId);
  const templates = data.templates
    .filter((template) => template.category !== 'email')
    .map((template) => ({
      templateKey: template.templateKey,
      name: template.name,
      category: template.category,
      description: template.description,
      sectionImageUrl: template.sectionImageUrl,
      folderId: template.folderId,
      updatedAt: template.updatedAt,
    }));

  return jsonSuccess(req, { templates });
});
