#!/usr/bin/env node
/**
 * Production-readiness doc 16 Phase 16.3: every Storage `.upload(` options
 * object must set `cacheControl`. The platform default (3600) is easy to miss
 * and wrong for both content-addressed (should be long) and replace-in-place
 * (should be short) paths.
 *
 * Scans supabase/functions (skips tests). A call site fails if the
 * next 12 lines after `.upload(` contain `{` but no `cacheControl`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const FUNCTIONS = join(ROOT, 'supabase', 'functions');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests') continue;
      walk(path, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('_test.ts')) {
      out.push(path);
    }
  }
  return out;
}

const files = walk(FUNCTIONS);
const failures = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/\.upload\s*\(/.test(lines[i])) continue;
    const window = lines.slice(i, i + 12).join('\n');
    if (!window.includes('{')) continue;
    if (!/cacheControl\s*:/.test(window)) {
      const rel = file.slice(ROOT.length + 1);
      failures.push(`${rel}:${i + 1}`);
    }
  }
}

if (failures.length) {
  console.error('Storage .upload() missing cacheControl (doc 16):\n');
  for (const row of failures) console.error(`  ${row}`);
  console.error('\nSet cacheControl: "31536000" on content-addressed paths, "300" on upsert/replace.');
  process.exit(1);
}

console.log(`ok: ${files.length} files, every .upload() options object sets cacheControl`);
