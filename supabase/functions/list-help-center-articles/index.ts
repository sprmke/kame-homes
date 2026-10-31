/**
 * list-help-center-articles — GET Host-facing knowledge Q&A entries grouped into
 * per-guide articles for the Help & Support Documentation module.
 * Auth: verifyAuthenticatedUser (any signed-in dashboard user — content isn't tenant-scoped).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

type KnowledgeBaseRow = {
  route_guide_path: string;
  route_guide_title: string | null;
  route_path: string | null;
  question: string;
  answer: string;
};

type HelpCenterArticle = {
  routeGuidePath: string;
  title: string;
  routePath: string | null;
  module: string;
  qaItems: Array<{ question: string; answer: string }>;
};

/** Buckets a route guide path into a readable module label for grouping in the UI. */
function deriveModule(routeGuidePath: string): string {
  const segments = routeGuidePath.replace(/^docs\/guides\/routes\//, '').split('/');
  const [first, second] = segments;
  if (first === 'org') {
    return second && segments.length > 2 ? capitalize(second) : 'Org';
  }
  return segments.length > 1 ? capitalize(first) : 'General';
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayArticleTitle(rawTitle: string | null, routeGuidePath: string): string {
  const fallback = routeGuidePath.split('/').pop()?.replace(/\.md$/, '') ?? 'Guide';
  let title = (rawTitle ?? fallback)
    .replace(/\s*[—–-]\s*operator guide\s*/gi, '')
    .replace(/\s*\((?:`[^`]+`|[^)]*\/:[^)]+)\)\s*/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!title || title.startsWith('docs/') || title.includes('/:')) {
    title = fallback.replace(/-/g, ' ');
  }
  return title;
}

serveAuthenticated('list-help-center-articles', async (req) => {
  requireHttpMethod(req, 'GET');

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ai_dashboard_assistant_knowledge_base')
    .select('route_guide_path, route_guide_title, route_path, question, answer')
    .order('route_guide_path', { ascending: true })
    .order('question', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as KnowledgeBaseRow[];
  const articlesByPath = new Map<string, HelpCenterArticle>();

  // Super-admin platform docs aren't relevant to hosts — exclude from the host-facing module.
  for (const row of rows) {
    if (row.route_guide_path.startsWith('docs/guides/routes/admin/')) continue;

    let article = articlesByPath.get(row.route_guide_path);
    if (!article) {
      article = {
        routeGuidePath: row.route_guide_path,
        title: displayArticleTitle(row.route_guide_title, row.route_guide_path),
        routePath: row.route_path,
        module: deriveModule(row.route_guide_path),
        qaItems: [],
      };
      articlesByPath.set(row.route_guide_path, article);
    }
    article.qaItems.push({ question: row.question, answer: row.answer });
  }

  const articles = Array.from(articlesByPath.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  return jsonSuccess(req, { articles });
});
