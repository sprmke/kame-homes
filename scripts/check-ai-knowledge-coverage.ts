#!/usr/bin/env bun
/**
 * Fails when a Documented route guide lacks a Host-facing knowledge section
 * with at least 3 Q&A rows, or when a previously synced guide would drop out
 * of `bun run sync:ai-knowledge-base`.
 *
 * Super-admin (`docs/guides/routes/admin/**`) and README indexes are exempt.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDES_DIR = join(ROOT, 'docs/guides/routes');
const SNAPSHOT_PATH = join(ROOT, 'scripts/ai-knowledge-synced-guides.txt');
const MIN_QA = 3;

function findMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...findMarkdownFiles(full));
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

function isExempt(relPath: string): boolean {
  if (relPath === 'docs/guides/routes/README.md') return true;
  if (relPath.startsWith('docs/guides/routes/admin/')) return true;
  return false;
}

function isDocumented(content: string): boolean {
  return (
    /\*\*Status:\*\*\s*Documented\b/i.test(content) || /^status:\s*documented\b/im.test(content)
  );
}

function extractQaCount(content: string): number {
  const headingMatch = content.match(/^## Host-facing knowledge\n/m);
  if (!headingMatch || headingMatch.index === undefined) return 0;
  const rest = content.slice(headingMatch.index + headingMatch[0].length);
  const endMatch = rest.match(/\n## |\n---\n/);
  const section = endMatch && endMatch.index !== undefined ? rest.slice(0, endMatch.index) : rest;
  const matches = section.match(/^- Q:\s*.+$/gm);
  return matches?.length ?? 0;
}

function loadSnapshot(): string[] {
  if (!existsSync(SNAPSHOT_PATH)) return [];
  return readFileSync(SNAPSHOT_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

const files = findMarkdownFiles(GUIDES_DIR);
const qaByPath = new Map<string, number>();
const missing: string[] = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  const content = readFileSync(file, 'utf8');
  const count = extractQaCount(content);
  qaByPath.set(rel, count);
  if (isExempt(rel) || !isDocumented(content)) continue;
  if (count < MIN_QA) {
    missing.push(`${rel} (${count} Q&A, need ${MIN_QA})`);
  }
}

const dropped: string[] = [];
for (const path of loadSnapshot()) {
  const count = qaByPath.get(path) ?? 0;
  if (count < 1) dropped.push(path);
}

if (missing.length > 0 || dropped.length > 0) {
  if (missing.length > 0) {
    console.error('Documented route guides missing Host-facing knowledge (≥3 Q&A):');
    for (const row of missing) console.error(`  - ${row}`);
  }
  if (dropped.length > 0) {
    console.error('Previously synced guides would drop from the knowledge base:');
    for (const row of dropped) console.error(`  - ${row}`);
  }
  process.exit(1);
}

const documented = [...qaByPath.keys()].filter((path) => {
  if (isExempt(path)) return false;
  const content = readFileSync(join(ROOT, path), 'utf8');
  return isDocumented(content);
}).length;
console.log(`OK — ${documented} documented host guides have ≥${MIN_QA} Host-facing knowledge Q&A.`);
