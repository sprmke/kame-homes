#!/usr/bin/env node
// One-off migration: add Obsidian frontmatter to every docs/**/*.md file and
// rewrite plain-text/code-span `docs/...md` path references into [[wikilinks]].
//
// Usage:
//   node scripts/docs/convert-to-obsidian.mjs [--dry-run] [--verbose]
//
// Safe to re-run: frontmatter insertion is skipped if a file already starts
// with `---`, and wikilink rewriting only matches literal `docs/...md`
// substrings, which no longer exist once converted.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const VERBOSE = args.has('--verbose');

// Files whose body prose must stay untouched (project constraints from the
// docs-obsidian-tooling-sync plan). Frontmatter is still added on top.
const WIKILINK_EXCLUDE = new Set([
  'archive/planning/CLAUDE_TO_PLAN.md',
  'archive/planning/TASKS_TO_PROMPT.md',
  // Historical record of this very refactor plan — full of stale references
  // to files already renamed/deleted by earlier tasks (docs/TODOS.md, the
  // old FOR_HOSTS_LANDING_PAGE_PLAN.md name, etc). Rewriting would fabricate
  // links to notes that no longer exist under those names.
  'superpowers/plans/2026-08-02-docs-obsidian-tooling-sync.md',
]);

function isPlannedModule(relFromDocs) {
  return relFromDocs.startsWith('workflow/planned/') && !relFromDocs.endsWith('README.md');
}

const ACRONYMS = new Set([
  'AI', 'UI', 'API', 'SD', 'GAF', 'PDF', 'QR', 'ID', 'URL', 'JWT', 'RLS',
  'CSV', 'SQL', 'CI', 'CD', 'MCP', 'RBAC', 'SPA', 'CRUD',
]);

function titleCaseWord(word) {
  if (!word) return word;
  const upper = word.toUpperCase();
  if (ACRONYMS.has(upper)) return upper;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function titleFromFilename(basename) {
  const words = basename.replace(/[-_]+/g, ' ').trim().split(/\s+/);
  return words.map(titleCaseWord).join(' ');
}

function cleanInlineMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function deriveTitle(content, basename) {
  const lines = content.split('\n');
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) return cleanInlineMarkdown(m[1]);
  }
  return titleFromFilename(basename);
}

const KEYWORD_TAGS = [
  [/booking|workflow/, 'booking-workflow'],
  [/gmail/, 'gmail-listener'],
  [/sd-form|sd-refund/, 'sd-refund'],
  [/calendar/, 'calendar'],
  [/sheet/, 'sheets'],
  [/email/, 'email'],
  [/auth|sign-in|login|invite/, 'auth'],
  [/finance/, 'finance'],
  [/maintenance/, 'maintenance'],
  [/marketing/, 'marketing'],
  [/inbox|messag/, 'inbox'],
  [/pricing/, 'pricing'],
  [/notification/, 'notifications'],
  [/team|staff/, 'team'],
  [/settings/, 'settings'],
  [/template/, 'templates'],
  [/migration/, 'migrations'],
  [/deploy/, 'deployment'],
  [/edge-functions/, 'edge-functions'],
  [/data-model/, 'data-model'],
  [/storage/, 'storage'],
  [/integrations/, 'integrations'],
  [/routing/, 'routing'],
  [/roadmap/, 'roadmap'],
  [/naming/, 'naming-conventions'],
  [/voucher/, 'voucher'],
  [/receipt|payment/, 'payments'],
  [/parking/, 'parking'],
  [/propert(y|ies)/, 'properties'],
  [/onboarding/, 'onboarding'],
  [/development/, 'developments'],
];

const TOP_DIR_TAGS = {
  architecture: 'architecture',
  guides: 'guides',
  operations: 'operations',
  planning: 'planning',
  reference: 'reference',
  superpowers: 'superpowers',
  todos: 'todos',
  workflow: 'workflow',
  archive: 'archive',
};

function deriveTags(relFromDocs) {
  const parts = relFromDocs.split('/');
  const filename = parts[parts.length - 1].toLowerCase();
  const tags = new Set();

  if (TOP_DIR_TAGS[parts[0]]) tags.add(TOP_DIR_TAGS[parts[0]]);
  if (parts.includes('routes')) tags.add('routes');
  if (parts.includes('admin')) tags.add('admin');
  if (parts.includes('org')) tags.add('org');
  if (parts.includes('property')) tags.add('property');
  if (parts.includes('parking')) tags.add('parking');
  if (parts.includes('account')) tags.add('account');
  if (parts.includes('planned')) tags.add('planned');
  if (parts[0] === 'workflow' && parts[1]) tags.add(parts[1]);
  if (parts.includes('shipped')) tags.add('shipped');
  if (parts[0] === 'archive' && parts[1] === 'reference') tags.add('reference');
  if (parts[0] === 'archive' && parts[1] === 'operations') tags.add('operations');
  if (parts.includes('archive')) tags.add('archive');

  for (const [re, tag] of KEYWORD_TAGS) {
    if (re.test(filename)) tags.add(tag);
  }

  if (tags.size === 0) tags.add('docs');
  return Array.from(tags).slice(0, 4);
}

function deriveStatus(relFromDocs) {
  return relFromDocs.split('/').includes('archive') ? 'archived' : 'active';
}

function todayISO() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildFrontmatter({ title, status, tags, updated }) {
  const tagsYaml = `[${tags.join(', ')}]`;
  return [
    '---',
    `title: ${yamlString(title)}`,
    `status: ${status}`,
    `tags: ${tagsYaml}`,
    `updated: ${updated}`,
    '---',
    '',
    '',
  ].join('\n');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

// Matches inline-code-span refs to other docs files, e.g. `docs/foo/bar.md`
// or `docs/foo/bar.md#anchor`. Skips spans that are the link-text half of an
// existing working markdown link, e.g. [`docs/foo.md`](../foo.md).
const BACKTICK_REF_RE = /`(docs\/[\w.\-/]+\.md)(#[\w-]*)?`(?!\]\()/g;

// Markdown table rows use unescaped `|` as the cell separator. A `[[id|Alias]]`
// wikilink alias would introduce a stray `|` that non-Obsidian renderers
// (GitHub, VS Code preview) would split into an extra cell — so inside table
// rows we emit a bare `[[identifier]]` with no alias.
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

// Obsidian treats `:` inside `[[id|Alias: …]]` as a block-ref suffix, truncating
// the alias. Pipe characters would break markdown table parsing. Emit bare links.
function formatWikilink(identifier, title, isTableRow) {
  if (isTableRow) return `[[${identifier}]]`;
  if (title.includes(':') || title.includes('|')) return `[[${identifier}]]`;
  return `[[${identifier}|${title}]]`;
}

function rewriteWikilinks(content, noteMap) {
  const lines = content.split('\n');
  let inFence = false;
  let conversions = 0;

  const out = lines.map((line) => {
    if (/^\s*(```+|~~~+)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const isTableRow = TABLE_ROW_RE.test(line);

    return line.replace(BACKTICK_REF_RE, (full, docsPath, anchor) => {
      // Anchors reference GitHub-style slugs that don't reliably map to
      // Obsidian heading names — be conservative and leave those untouched.
      if (anchor) return full;
      const entry = noteMap.get(docsPath);
      if (!entry) return full; // target renamed/deleted — leave prose as-is
      conversions += 1;
      return formatWikilink(entry.identifier, entry.title, isTableRow);
    });
  });

  return { content: out.join('\n'), conversions };
}

function main() {
  const files = walk(DOCS_DIR).sort();

  // Pass 1: compute frontmatter fields for every file.
  const meta = new Map(); // absPath -> { relFromDocs, basename, title, status, tags, hasFrontmatter, raw }
  for (const absPath of files) {
    const raw = fs.readFileSync(absPath, 'utf8');
    const relFromDocs = path.relative(DOCS_DIR, absPath).split(path.sep).join('/');
    const basename = path.basename(relFromDocs, '.md');
    const hasFrontmatter = raw.startsWith('---\n') || raw.startsWith('---\r\n');
    const title = deriveTitle(raw, basename);
    const status = deriveStatus(relFromDocs);
    const tags = deriveTags(relFromDocs);
    meta.set(absPath, { relFromDocs, basename, title, status, tags, hasFrontmatter, raw });
  }

  // Pass 2: build filename -> note-name map, preferring unique basenames.
  const basenameCount = new Map();
  for (const { basename } of meta.values()) {
    basenameCount.set(basename, (basenameCount.get(basename) || 0) + 1);
  }

  const noteMap = new Map(); // "docs/relFromDocs.md" -> { identifier, title }
  for (const { relFromDocs, basename, title } of meta.values()) {
    const relFromDocsNoExt = relFromDocs.replace(/\.md$/, '');
    const identifier = basenameCount.get(basename) === 1 ? basename : relFromDocsNoExt;
    noteMap.set(`docs/${relFromDocs}`, { identifier, title });
  }

  // Pass 3: write frontmatter + rewrite wikilinks.
  const updated = todayISO();
  let frontmatterAdded = 0;
  let filesWithWikilinks = 0;
  let totalConversions = 0;
  const skippedWikilinkFiles = [];

  for (const absPath of files) {
    const info = meta.get(absPath);
    let content = info.raw;
    let changed = false;

    if (!info.hasFrontmatter) {
      const frontmatter = buildFrontmatter({
        title: info.title,
        status: info.status,
        tags: info.tags,
        updated,
      });
      content = frontmatter + content;
      changed = true;
      frontmatterAdded += 1;
    }

    const wikilinkEligible =
      !WIKILINK_EXCLUDE.has(info.relFromDocs) && !isPlannedModule(info.relFromDocs);

    if (wikilinkEligible) {
      const { content: rewritten, conversions } = rewriteWikilinks(content, noteMap);
      if (conversions > 0) {
        content = rewritten;
        changed = true;
        filesWithWikilinks += 1;
        totalConversions += conversions;
        if (VERBOSE) console.log(`  ${info.relFromDocs}: ${conversions} wikilink(s)`);
      }
    } else {
      skippedWikilinkFiles.push(info.relFromDocs);
    }

    if (changed && !DRY_RUN) {
      fs.writeFileSync(absPath, content, 'utf8');
    }
  }

  console.log(`Scanned ${files.length} docs/**/*.md files${DRY_RUN ? ' (dry run)' : ''}.`);
  console.log(`Frontmatter added: ${frontmatterAdded}`);
  console.log(`Files with wikilinks rewritten: ${filesWithWikilinks} (${totalConversions} total conversions)`);
  console.log(`Wikilink-rewrite excluded (frontmatter only): ${skippedWikilinkFiles.length}`);
  if (VERBOSE) {
    for (const f of skippedWikilinkFiles) console.log(`  excluded: ${f}`);
  }
}

main();
