#!/usr/bin/env node
/**
 * Read-only: list every open item in readiness-related docs.
 *
 * Open item = an unchecked `- [ ]` box, or a row in a "Remaining work" /
 * "Open questions" / "Pending" table that is not struck through or marked Done.
 *
 * Usage:
 *   node scripts/dev/readiness-open-items.mjs            # markdown to stdout
 *   node scripts/dev/readiness-open-items.mjs --json     # JSON to stdout
 *   node scripts/dev/readiness-open-items.mjs --summary  # counts per file
 *
 * Feeds docs/workflow/in-progress/production-readiness/LEDGER.md (Phase 2).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SOURCES = [
  'docs/workflow/in-progress/production-readiness',
  'docs/workflow/done',
  'docs/workflow/for-testing',
  'docs/guides/testing',
];
const SKIP_DIRS = new Set(['evidence', 'baselines', 'modules', 'security']);
// The audit plan's own phase boxes are the work itself, not ledger input.
const SKIP_FILES = new Set(['production-readiness-launch-audit.md', 'LEDGER.md', 'TO-FIX.md', 'ALL-GOOD.md']);
const OPEN_SECTION = /remaining|open question|pending|residual|deferred|not done|still open|to do|todo/i;
const DONE_CELL = /~~|\*\*done\*\*|^\s*done\b|✅/i;

function walk(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(rel);
    return e.name.endsWith('.md') && e.name !== 'README.md' && !SKIP_FILES.has(e.name) ? [rel] : [];
  });
}

function extract(file) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  const items = [];
  let heading = '';
  let inFence = false;
  let inOpenSection = false;
  let tableHeaderSeen = false;
  lines.forEach((line, i) => {
    if (/^```/.test(line)) inFence = !inFence;
    if (inFence) return;
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) {
      heading = h[2].trim();
      inOpenSection = OPEN_SECTION.test(heading);
      tableHeaderSeen = false;
      return;
    }
    const box = line.match(/^\s*[-*]\s+\[ \]\s+(.*)/);
    if (box) {
      items.push({ file, line: i + 1, heading, kind: 'box', text: box[1].trim() });
      return;
    }
    if (/^\|/.test(line) && /\|\s*\[ \]\s*\|/.test(line)) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      items.push({ file, line: i + 1, heading, kind: 'row', text: cells.filter((c) => c !== '[ ]').join(' | ') });
      return;
    }
    if (inOpenSection && /^\|/.test(line)) {
      if (/^\|[\s|:-]+\|?\s*$/.test(line)) {
        tableHeaderSeen = true;
        return;
      }
      if (!tableHeaderSeen) return;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const body = cells.join(' | ');
      if (cells.some((c) => DONE_CELL.test(c))) return;
      items.push({ file, line: i + 1, heading, kind: 'row', text: body });
    } else if (!/^\|/.test(line)) {
      tableHeaderSeen = false;
    }
  });
  return items;
}

const all = SOURCES.flatMap(walk).sort().flatMap(extract);
const mode = process.argv[2];

if (mode === '--json') {
  process.stdout.write(JSON.stringify(all, null, 2));
} else if (mode === '--summary') {
  const counts = new Map();
  for (const it of all) counts.set(it.file, (counts.get(it.file) ?? 0) + 1);
  for (const [f, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${f}`);
  console.log(`${all.length} open items in ${counts.size} files`);
} else {
  let last = '';
  for (const it of all) {
    if (it.file !== last) {
      console.log(`\n## ${it.file}\n`);
      last = it.file;
    }
    const text = it.text.length > 240 ? `${it.text.slice(0, 237)}...` : it.text;
    console.log(`- L${it.line} (${it.kind}, ${it.heading || 'top'}): ${text.replace(/\s+/g, ' ')}`);
  }
}
