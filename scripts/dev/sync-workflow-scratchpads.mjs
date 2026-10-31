#!/usr/bin/env node
/**
 * Sync status emojis in docs/workflow/intake scratchpads from workflow folder state.
 *
 * Usage:
 *   node scripts/dev/sync-workflow-scratchpads.mjs [--dry-run] [--report] [--slug=foo]
 *
 * Reads linked workflow doc paths in each item block and sets the title emoji:
 * in-progress → 🚧, for-testing → 🧪, planned → 📋, done → ✅, wont-do → ❌.
 * Never changes ❌ items. Never downgrades emojis (except 🔵 → higher).
 * Optional --fuzzy for title/slug guessing (off by default — too many false positives).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const SCRATCHPADS = [
  path.join(ROOT, 'docs/workflow/intake/_to-prompt.md'),
  path.join(ROOT, 'docs/workflow/intake/_to-plan.md'),
];

const STAGES = ['in-progress', 'for-testing', 'planned', 'done', 'wont-do'];
const STAGE_EMOJI = {
  'in-progress': '🚧',
  'for-testing': '🧪',
  planned: '📋',
  done: '✅',
  'wont-do': '❌',
};
const STAGE_PRIORITY = { 'wont-do': 0, 'for-testing': 4, 'in-progress': 3, planned: 2, done: 1 };
const EMOJI_RANK = { '❌': 99, '✅': 4, '🧪': 3.5, '🚧': 3, '📋': 2, '🔵': 1 };
const TITLE_EMOJI_RE = /^(✅|🧪|🚧|📋|🔵|❌)\s+/;
const WORKFLOW_PATH_RE =
  /(?:\.\.\/|\/)?(?:docs\/workflow\/)?(?:planned|in-progress|for-testing|done|wont-do)\/([^\s`)]+?)(?:\.md)?(?:[`)\s]|$)/g;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const reportOrphans = args.includes('--report');
const enableFuzzy = args.includes('--fuzzy');
const slugFilter = args.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);
const normalizedSlugFilter = slugFilter
  ? slugFilter.replace(/\.md$/, '').toLowerCase()
  : null;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readTitleFromFrontmatter(content) {
  const m = content.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
  return m ? m[1].trim() : null;
}

function buildWorkflowIndex() {
  /** @type {Map<string, { stage: string, relPath: string, title: string | null }>} */
  const index = new Map();

  for (const stage of STAGES) {
    const dir = path.join(ROOT, 'docs/workflow', stage);
    if (!fs.existsSync(dir)) continue;

    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.md') || name === 'README.md') continue;
      const slug = name.replace(/\.md$/, '');
      const fullPath = path.join(dir, name);
      const content = fs.readFileSync(fullPath, 'utf8');
      index.set(slug, {
        stage,
        relPath: `docs/workflow/${stage}/${name}`,
        title: readTitleFromFrontmatter(content),
      });
    }
  }

  return index;
}

function extractSlugsFromText(text) {
  const slugs = new Set();
  WORKFLOW_PATH_RE.lastIndex = 0;
  let m;
  while ((m = WORKFLOW_PATH_RE.exec(text)) !== null) {
    const raw = m[1].replace(/\.md$/, '');
    if (raw && raw !== 'README') slugs.add(raw);
  }
  return [...slugs];
}

function resolveEmojiFromSlugs(slugs, index) {
  for (const slug of slugs) {
    const entry = index.get(slug);
    if (entry?.stage === 'wont-do') return '❌';
  }

  let bestStage = null;
  let bestPriority = 0;

  for (const slug of slugs) {
    const entry = index.get(slug);
    if (!entry || entry.stage === 'wont-do') continue;
    const priority = STAGE_PRIORITY[entry.stage] ?? 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      bestStage = entry.stage;
    }
  }

  return bestStage ? STAGE_EMOJI[bestStage] : null;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function fuzzyMatchSlug(titleText, index) {
  const words = tokenize(titleText);
  if (words.length === 0) return null;

  let bestSlug = null;
  let bestScore = 0;

  for (const [slug, entry] of index) {
    const slugTokens = slug.split('-').filter((t) => t.length > 2);
    let score = 0;

    for (const word of words) {
      if (slug.includes(word)) score += 2;
      if (slugTokens.some((t) => t === word)) score += 1.5;
    }

    for (const token of slugTokens) {
      if (token.length > 4 && titleText.toLowerCase().includes(token)) score += 1;
    }

    if (entry.title) {
      const titleWords = tokenize(entry.title);
      const overlap = words.filter((w) => titleWords.includes(w)).length;
      score += overlap * 1.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSlug = slug;
    }
  }

  return bestScore >= 3 ? bestSlug : null;
}

function parseBlocks(content) {
  const lines = content.split('\n');
  /** @type {{ start: number, titleLine: number, end: number, title: string, emoji: string, body: string }[]} */
  const blocks = [];

  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() !== '===') {
      i += 1;
      continue;
    }

    const start = i;
    i += 1;

    while (i < lines.length && lines[i].trim() === '') i += 1;
    if (i >= lines.length) break;

    const titleLine = i;
    const title = lines[i];
    const emojiMatch = title.match(/^(✅|🚧|📋|🔵|❌)\s+/);
    const emoji = emojiMatch ? emojiMatch[1] : '🔵';

    i += 1;
    while (i < lines.length && lines[i].trim() !== '===') i += 1;
    const end = i < lines.length ? i : lines.length - 1;

    const body = lines.slice(titleLine + 1, end).join('\n');
    blocks.push({ start, titleLine, end, title, emoji, body });
  }

  return { lines, blocks };
}

function blockMatchesSlugFilter(slugs, fuzzySlug) {
  if (!normalizedSlugFilter) return true;
  const all = [...slugs];
  if (fuzzySlug) all.push(fuzzySlug);
  return all.some((s) => s.toLowerCase() === normalizedSlugFilter);
}

function targetEmojiForBlock(block, index) {
  if (block.emoji === '❌') return null;

  const slugs = extractSlugsFromText(block.body);

  if (slugs.length === 0) {
    if (!enableFuzzy) return null;
    const fuzzySlug = fuzzyMatchSlug(block.title.replace(TITLE_EMOJI_RE, ''), index);
    if (!fuzzySlug || !blockMatchesSlugFilter([], fuzzySlug)) return null;
    const entry = index.get(fuzzySlug);
    return entry ? STAGE_EMOJI[entry.stage] : null;
  }

  if (!blockMatchesSlugFilter(slugs, null)) return null;
  return resolveEmojiFromSlugs(slugs, index);
}

function shouldApplyEmoji(current, target) {
  if (!target || target === current) return false;
  if (current === '❌') return false;
  if (target === '❌') return true;
  if (current === '🔵') return true;
  return (EMOJI_RANK[target] ?? 0) >= (EMOJI_RANK[current] ?? 0);
}

function syncScratchpad(filePath, index) {
  const rel = path.relative(ROOT, filePath);
  const original = fs.readFileSync(filePath, 'utf8');
  const { lines, blocks } = parseBlocks(original);
  /** @type {{ line: number, from: string, to: string, reason: string }[]} */
  const changes = [];

  for (const block of blocks) {
    const target = targetEmojiForBlock(block, index);
    if (!shouldApplyEmoji(block.emoji, target)) continue;

    const newTitle = block.title.replace(TITLE_EMOJI_RE, `${target} `);
    if (newTitle === block.title) continue;

    changes.push({
      line: block.titleLine + 1,
      from: block.title,
      to: newTitle,
      reason: `workflow state → ${target}`,
    });
    lines[block.titleLine] = newTitle;
  }

  if (changes.length === 0) {
    return { rel, changes, content: original };
  }

  let content = lines.join('\n');
  if (!dryRun) {
    content = content.replace(/^updated:\s*.+$/m, `updated: ${todayIso()}`);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return { rel, changes, content };
}

function collectReferencedSlugs(content) {
  return new Set(extractSlugsFromText(content));
}

function reportUnreferencedWorkflowDocs(index, scratchpadContents) {
  const referenced = new Set();
  for (const content of scratchpadContents) {
    for (const slug of collectReferencedSlugs(content)) referenced.add(slug);
  }

  /** @type {string[]} */
  const orphans = [];
  for (const [slug, entry] of index) {
    if (!referenced.has(slug)) {
      orphans.push(`  ${entry.stage.padEnd(12)} ${slug} (${entry.relPath})`);
    }
  }

  orphans.sort();
  return orphans;
}

function main() {
  const index = buildWorkflowIndex();
  let totalChanges = 0;

  console.log(
    dryRun
      ? 'sync-workflow-scratchpads: dry run (no files written)\n'
      : 'sync-workflow-scratchpads: applying updates\n',
  );

  if (normalizedSlugFilter) {
    console.log(`Filter: slug=${normalizedSlugFilter}\n`);
  }

  const scratchpadContents = [];

  for (const filePath of SCRATCHPADS) {
    if (!fs.existsSync(filePath)) {
      console.error(`Missing scratchpad: ${filePath}`);
      process.exit(1);
    }

    const { rel, changes } = syncScratchpad(filePath, index);
    scratchpadContents.push(fs.readFileSync(filePath, 'utf8'));

    if (changes.length === 0) {
      console.log(`${rel}: up to date`);
      continue;
    }

    for (const change of changes) {
      console.log(`${rel}:${change.line}`);
      console.log(`  - ${change.from}`);
      console.log(`  + ${change.to}`);
      console.log(`  (${change.reason})`);
    }

    totalChanges += changes.length;
  }

  if (reportOrphans || totalChanges === 0) {
    const orphans = reportUnreferencedWorkflowDocs(index, scratchpadContents);
    if (orphans.length > 0) {
      console.log('\nWorkflow docs not linked from any scratchpad item (add → links or ignore):');
      console.log(orphans.join('\n'));
    }
  }

  if (totalChanges === 0) {
    console.log('\nNo emoji changes needed.');
  } else if (dryRun) {
    console.log(`\n${totalChanges} change(s) would be applied. Re-run without --dry-run to write.`);
  } else {
    console.log(`\nApplied ${totalChanges} emoji update(s).`);
    console.log('Run: bun run check:workflow-scratchpads');
  }
}

main();
