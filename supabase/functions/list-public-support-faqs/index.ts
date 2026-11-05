/**
 * list-public-support-faqs — public GET for `/support` and the signed-in guest
 * help surface. Returns published FAQs with their audience so the client can
 * split guest and host sections. No tenant scope: FAQ content is platform copy.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccessWithETag, requireHttpMethod } from '../_shared/httpResponse.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

type FaqRow = {
  id: string;
  category: string;
  question: string;
  answer: string;
  audience: 'host' | 'guest' | 'public';
  sort_order: number;
};

servePublic('list-public-support-faqs', async (req) => {
  requireHttpMethod(req, 'GET');

  const limited = await publicGetRateLimitGate(req, 'list-public-support-faqs');
  if (limited) return limited;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('help_center_faqs')
    .select('id, category, question, answer, audience, sort_order')
    .eq('is_published', true)
    .in('audience', ['guest', 'host', 'public'])
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .limit(500);

  if (error) return jsonError(req, error.message, 500);

  // Curated content changes only when the docs sync or a super-admin edit runs.
  return jsonSuccessWithETag(
    req,
    {
      faqs: ((data ?? []) as FaqRow[]).map((row) => ({
        id: row.id,
        category: row.category,
        question: row.question,
        answer: row.answer,
        audience: row.audience,
        sortOrder: row.sort_order,
      })),
    },
    'publicStatic'
  );
});
