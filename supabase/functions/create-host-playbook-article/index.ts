/**
 * create-host-playbook-article — POST new Improvement Playbook article (super admin).
 * Host Analytics module Phase 4 CRUD. Plan: docs/workflow/in-progress/host-analytics-module.md
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

serveSuperAdmin('create-host-playbook-article', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  if (!slug || !SLUG_RE.test(slug)) {
    return jsonError(req, 'slug is required (lowercase letters, digits, hyphens only)');
  }

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!category) return jsonError(req, 'category is required');

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return jsonError(req, 'title is required');

  const bodyMd = typeof body.bodyMd === 'string' ? body.bodyMd.trim() : '';
  if (!bodyMd) return jsonError(req, 'bodyMd is required');

  let appliesWhen: Record<string, unknown> = {};
  if (body.appliesWhen !== undefined) {
    if (typeof body.appliesWhen !== 'object' || body.appliesWhen === null) {
      return jsonError(req, 'appliesWhen must be a JSON object');
    }
    appliesWhen = body.appliesWhen as Record<string, unknown>;
  }

  const sortOrder = typeof body.sortOrder === 'number' ? Math.round(body.sortOrder) : 0;
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('host_playbook_articles')
    .insert({
      slug,
      category,
      title,
      body_md: bodyMd,
      applies_when: appliesWhen,
      sort_order: sortOrder,
      is_active: isActive,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505')
      return jsonError(req, `An article with slug "${slug}" already exists`);
    return jsonError(req, `Failed to create article: ${error.message}`, 500);
  }

  await logSuperAdminAction(user, {
    action: 'host_playbook.article_created',
    targetType: 'host_playbook_article',
    targetId: typeof data.id === 'string' ? data.id : null,
    summary: 'Created host playbook article',
    metadata: { slug, category },
  });

  return jsonSuccess(req, { article: data });
});
