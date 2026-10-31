#!/usr/bin/env bun
/**
 * Brand guard (kamespace-03). Scans tracked files for legacy brand strings.
 *
 * Default mode: report only (exit 0). Pass `--check` to fail (exit 1) on any
 * unclassified hit. Pass `--list` to print every hit line.
 *
 * Allow-list: scripts/brand/brand-allowlist.txt (class K).
 * Class D (domain/hostname) hits are reported but never fail (owned by kamespace-04).
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ALLOWLIST_PATH = resolve(ROOT, 'scripts/brand/brand-allowlist.txt');

const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const listMode = args.includes('--verbose') || args.includes('--list');

// Binary / non-text extensions to skip.
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.m4a', '.aac',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.tar', '.tgz', '.7z',
  '.lock', '.map',
  '.db', '.sqlite', '.wasm',
]);

// Case-insensitive legacy brand pattern (covers Kame Homes, Kame Home, KameHomes,
// kame-homes, kamehomes, kamehome, KAME_HOMES, etc.). Bare "Homes"/"Kame" never match.
const BRAND_RE = /kame[\s_-]?homes?\b/gi;

function isBinaryPath(p: string): boolean {
  const dot = p.lastIndexOf('.');
  if (dot === -1) return false;
  return SKIP_EXT.has(p.slice(dot).toLowerCase());
}

function isDomainClassD(line: string): boolean {
  const l = line.toLowerCase();
  if (/kamehomes?\.space/.test(l)) return true;
  if (/kame-homes?.*vercel/.test(l)) return true;
  if (/vercel.*kame-homes?/.test(l)) return true;
  if (/kamehomes?.*vercel/.test(l)) return true;
  return false;
}

// --- allowlist parsing ---
type AllowEntry = { file: string; pattern: RegExp | null; reason: string; glob: boolean };
const allowEntries: AllowEntry[] = [];
if (existsSync(ALLOWLIST_PATH)) {
  for (const raw of readFileSync(ALLOWLIST_PATH, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(.*?)\s+#\s+(.*)$/);
    const token = (m ? m[1] : line).trim();
    const reason = m ? m[2].trim() : '';
    if (!token) continue;
    let file = token;
    let pattern: RegExp | null = null;
    const colon = token.indexOf(':');
    if (colon > 0) {
      const candidate = token.slice(0, colon);
      // only split if the candidate looks like a path (no spaces) and exists or is a glob
      if (!/\s/.test(candidate)) {
        file = candidate;
        const pat = token.slice(colon + 1).trim();
        if (pat) {
          try {
            pattern = new RegExp(pat, 'i');
          } catch {
            pattern = null;
          }
        }
      }
    }
    const glob = file.includes('*');
    allowEntries.push({ file, pattern, reason, glob });
  }
}

function globToRegex(glob: string): RegExp {
  // escape regex specials except *
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const re = escaped.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
  return new RegExp('^' + re + '$');
}

function allowlistedPathMatches(relPath: string): AllowEntry[] {
  return allowEntries.filter((e) => {
    if (e.glob) {
      return globToRegex(e.file).test(relPath);
    }
    return relPath === e.file;
  });
}

function isAllowlisted(relPath: string, lineText: string): boolean {
  const candidates = allowlistedPathMatches(relPath);
  if (candidates.length === 0) return false;
  // If any entry for this file has no pattern, whole file is allowed.
  if (candidates.some((e) => e.pattern === null)) return true;
  // Otherwise allow if any pattern matches the line.
  return candidates.some((e) => e.pattern !== null && e.pattern.test(lineText));
}

// --- scan ---
const filesRaw = execSync('git ls-files -z', { cwd: ROOT, encoding: 'buffer' });
const files = filesRaw.toString('utf8').split('\0').filter(Boolean);

type Hit = { file: string; lineNo: number; text: string; cls: 'D' | 'U' };
const hits: Hit[] = [];

for (const rel of files) {
  if (isBinaryPath(rel)) continue;
  const full = resolve(ROOT, rel);
  let content: string;
  try {
    content = readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    // reset regex lastIndex
    BRAND_RE.lastIndex = 0;
    if (!BRAND_RE.test(line)) return;
    if (isAllowlisted(rel, line)) return;
    const cls: 'D' | 'U' = isDomainClassD(line) ? 'D' : 'U';
    hits.push({ file: rel, lineNo: idx + 1, text: line.trim(), cls });
  });
}

// --- report ---
const unclassified = hits.filter((h) => h.cls === 'U');
const domain = hits.filter((h) => h.cls === 'D');

// per-file counts for unclassified
const byFile = new Map<string, number>();
for (const h of unclassified) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);

console.log(`[check-brand] scanned ${files.length} tracked files`);
console.log(`[check-brand] unclassified (class A/B/C/E): ${unclassified.length} hit(s) across ${byFile.size} file(s)`);
console.log(`[check-brand] domain (class D, owned by kamespace-04): ${domain.length} hit(s)`);
console.log(`[check-brand] allow-listed (class K): skipped`);

if (byFile.size > 0) {
  console.log('\n-- unclassified by file --');
  const sorted = [...byFile.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [f, n] of sorted) console.log(`  ${n.toString().padStart(4)}  ${f}`);
}

if (listMode && unclassified.length > 0) {
  console.log('\n-- unclassified hits --');
  for (const h of unclassified) console.log(`  ${h.file}:${h.lineNo}: ${h.text.slice(0, 200)}`);
}

if (domain.length > 0 && listMode) {
  console.log('\n-- domain (class D) hits --');
  const dByFile = new Map<string, number>();
  for (const h of domain) dByFile.set(h.file, (dByFile.get(h.file) ?? 0) + 1);
  for (const [f, n] of [...dByFile.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(4)}  ${f}`);
  }
}

if (checkMode && unclassified.length > 0) {
  console.error(`\n[check-brand] FAIL: ${unclassified.length} unclassified brand hit(s).`);
  process.exit(1);
}
process.exit(0);
