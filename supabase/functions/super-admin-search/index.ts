/**
 * super-admin-search — GET a cross-entity jump index for the `/admin/*` ⌘K palette.
 * `?q=` fans out over organizations, properties, parkings, and support tickets.
 * Super-admin only, read-only, bounded (`ilike` + small per-source limit).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

const PER_SOURCE = 6;

type Hit = { type: string; label: string; sublabel: string | null; href: string };

serveSuperAdmin('super-admin-search', async (req) => {
  requireHttpMethod(req, 'GET');
  const supabase = createServiceClient();
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return jsonSuccess(req, { query: q, results: [] });

  const pattern = postgrestOrIlikeValue(q);

  const [orgs, properties, parkings, tickets] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, slug')
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .limit(PER_SOURCE),
    supabase
      .from('properties')
      .select('name, slug, organizations(slug, name)')
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .limit(PER_SOURCE),
    supabase
      .from('parkings')
      .select('name, slug, organizations(slug, name)')
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .limit(PER_SOURCE),
    supabase
      .from('support_tickets')
      .select('id, subject, submitted_by_name, submitted_by_email')
      .or(
        `subject.ilike.${pattern},submitted_by_name.ilike.${pattern},submitted_by_email.ilike.${pattern}`
      )
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE),
  ]);

  const firstError = orgs.error ?? properties.error ?? parkings.error ?? tickets.error ?? null;
  if (firstError) return jsonError(req, firstError.message, 500);

  const results: Hit[] = [];

  for (const o of orgs.data ?? []) {
    results.push({
      type: 'organization',
      label: o.name as string,
      sublabel: `/${o.slug}`,
      href: `/admin/orgs/${o.slug}`,
    });
  }
  for (const p of properties.data ?? []) {
    const org = p.organizations as { slug: string; name: string } | null;
    results.push({
      type: 'property',
      label: p.name as string,
      sublabel: org ? `${org.name} · property` : 'property',
      href: org ? `/admin/orgs/${org.slug}/listings` : '/admin/properties',
    });
  }
  for (const p of parkings.data ?? []) {
    const org = p.organizations as { slug: string; name: string } | null;
    results.push({
      type: 'parking',
      label: p.name as string,
      sublabel: org ? `${org.name} · parking` : 'parking',
      href: org ? `/admin/orgs/${org.slug}/listings` : '/admin/orgs',
    });
  }
  for (const t of tickets.data ?? []) {
    results.push({
      type: 'ticket',
      label: t.subject as string,
      sublabel: `ticket · ${(t.submitted_by_name as string) || (t.submitted_by_email as string)}`,
      href: '/admin/support',
    });
  }

  return jsonSuccess(req, { query: q, results });
});
