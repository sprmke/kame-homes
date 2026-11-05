/**
 * Shared parsing for the support-content pipeline.
 *
 * Sources:
 *   - `docs/guides/routes/**` → per-route `## Host-facing knowledge` Q&A
 *   - `docs/guides/support/faqs.md` → cross-cutting curated FAQs
 *
 * The same parsers feed `sync-ai-knowledge-base.ts`, `check-support-content.ts`
 * and `check-ai-knowledge-coverage.ts`, so a guide change cannot pass one check
 * and fail another on a parsing difference.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GUIDES_DIR = join(ROOT, 'docs/guides/routes');
export const SUPPORT_DIR = join(ROOT, 'docs/guides/support');
export const CURATED_FAQS_PATH = join(SUPPORT_DIR, 'faqs.md');

export type Audience = 'host' | 'guest' | 'public';

export type KnowledgeEntry = {
  routeGuidePath: string;
  routePath: string | null;
  routeGuideTitle: string | null;
  question: string;
  answer: string;
  audience: Audience;
};

export type CuratedFaq = {
  contentKey: string;
  category: string;
  audience: Audience;
  source: string | null;
  order: number;
  question: string;
  answer: string;
};

export function findMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...findMarkdownFiles(full));
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Pulls a `Route: /some/path` line from a leading frontmatter/metadata block, if present. */
export function extractRoutePath(content: string): string | null {
  const match = content.match(/^Route:\s*(\S+)/m);
  return match ? match[1] : null;
}

/** Pulls the `title:` frontmatter line, if present (e.g. 'Bookings List — operator guide'). */
export function extractTitle(content: string): string | null {
  const match = content.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
  if (!match) return null;
  // Article titles render in-app, so keep them free of em dashes.
  return match[1].replace(/\s+—\s+/g, ' - ').replace(/—/g, '-');
}

/** Reads `audience:` from route-guide frontmatter when present. */
export function extractFrontmatterAudience(content: string): Audience | null {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return null;
  const match = frontmatter[1].match(/^audience:\s*['"]?(\w+)['"]?\s*$/m);
  if (!match) return null;
  const value = match[1].toLowerCase();
  return value === 'host' || value === 'guest' || value === 'public' ? value : null;
}

/**
 * Path-based audience default. `admin/**` is internal (never synced to host
 * surfaces), so it has no audience value here.
 */
export function defaultAudienceForPath(relPath: string): Audience | null {
  const path = relPath.replace(/^docs\/guides\/routes\//, '');
  if (path.startsWith('admin/')) return null;
  if (path.startsWith('org/')) return 'host';
  if (
    path.startsWith('account/') ||
    path.startsWith('properties/') ||
    path.startsWith('bookings/') ||
    [
      'trip.md',
      'stay-guide.md',
      'form.md',
      'sd-form.md',
      'success.md',
      'search.md',
      'parkings.md',
      'guest-booking-document.md',
    ].includes(path)
  ) {
    return 'guest';
  }
  return 'public';
}

export function resolveAudience(content: string, relPath: string): Audience | null {
  return extractFrontmatterAudience(content) ?? defaultAudienceForPath(relPath);
}

/** Returns the `## Host-facing knowledge` section body, or null when absent. */
export function extractHostFacingSection(content: string): string | null {
  const headingMatch = content.match(/^## Host-facing knowledge\n/m);
  if (!headingMatch || headingMatch.index === undefined) return null;
  const sectionStart = headingMatch.index + headingMatch[0].length;
  const rest = content.slice(sectionStart);
  const endMatch = rest.match(/\n## |\n---\n/);
  return endMatch && endMatch.index !== undefined ? rest.slice(0, endMatch.index) : rest;
}

export function countHostFacingQa(content: string): number {
  const section = extractHostFacingSection(content);
  if (!section) return 0;
  return section.match(/^- Q:\s*.+$/gm)?.length ?? 0;
}

export function extractHostFacingKnowledge(
  content: string
): Array<{ question: string; answer: string }> {
  const section = extractHostFacingSection(content);
  if (!section) return [];

  const entries: Array<{ question: string; answer: string }> = [];
  const qaPattern = /- Q:\s*(.+?)\n\s+A:\s*([\s\S]*?)(?=\n- Q:|\n\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = qaPattern.exec(section)) !== null) {
    const question = match[1].trim();
    const answer = match[2].replace(/\s+/g, ' ').trim();
    if (question && answer) entries.push({ question, answer });
  }
  return entries;
}

export function loadRouteGuideEntries(): {
  files: string[];
  entries: KnowledgeEntry[];
} {
  const files = findMarkdownFiles(GUIDES_DIR);
  const entries: KnowledgeEntry[] = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const routeGuidePath = relative(ROOT, file);
    const audience = resolveAudience(content, routeGuidePath);
    if (!audience) continue;
    const routePath = extractRoutePath(content);
    const routeGuideTitle = extractTitle(content);
    for (const entry of extractHostFacingKnowledge(content)) {
      entries.push({ ...entry, routeGuidePath, routePath, routeGuideTitle, audience });
    }
  }
  return { files, entries };
}

/** Stable key for a synced FAQ. Question text is unique per category by convention. */
export function contentKeyFor(category: string, question: string): string {
  return `${slugify(category)}--${slugify(question)}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Parses `docs/guides/support/faqs.md`.
 *
 * One `### Question` block per FAQ, with a short metadata list:
 *
 *   - category: Getting Started
 *   - audience: host
 *   - source: docs/guides/routes/org/selector.md
 *   - order: 10
 *
 * File order is the fallback when `order` is absent.
 */
export function parseCuratedFaqs(content: string): CuratedFaq[] {
  const faqs: CuratedFaq[] = [];
  const blocks = content.split(/^### /m).slice(1);
  for (const [index, block] of blocks.entries()) {
    const [headingLine, ...restLines] = block.split('\n');
    const question = headingLine.trim();
    if (!question) continue;

    let cursor = 0;
    const meta: Record<string, string> = {};
    while (cursor < restLines.length) {
      const line = restLines[cursor]!;
      if (!line.trim()) {
        cursor += 1;
        continue;
      }
      const match = line.match(/^- ([a-z][a-z-]*):\s*(.+?)\s*$/i);
      if (!match) break;
      meta[match[1]!.toLowerCase()] = match[2]!;
      cursor += 1;
    }

    const answer = restLines
      .slice(cursor)
      .join('\n')
      .split(/\n---\n/)[0]!
      .replace(/\s+/g, ' ')
      .trim();
    if (!answer) continue;

    const category = meta.category?.trim();
    if (!category) continue;
    const audience = (meta.audience?.trim().toLowerCase() ?? 'host') as Audience;
    const order = meta.order && /^\d+$/.test(meta.order) ? Number(meta.order) : (index + 1) * 10;

    faqs.push({
      contentKey: contentKeyFor(category, question),
      category,
      audience: audience === 'guest' || audience === 'public' ? audience : 'host',
      source: meta.source?.trim() || null,
      order,
      question,
      answer,
    });
  }
  return faqs;
}

export function loadCuratedFaqs(): CuratedFaq[] {
  return parseCuratedFaqs(readFileSync(CURATED_FAQS_PATH, 'utf8'));
}
