#!/usr/bin/env bun
/**
 * Reorganize gitignored env files: keep code-referenced keys only, short section headers.
 * Usage: bun scripts/dev/reorganize-env-files.mjs [--dry-run] [--keep-unmapped]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMAS } from './env-file-schemas.mjs';

const ROOT = join(import.meta.dir, '../..');
const DRY_RUN = process.argv.includes('--dry-run');
const KEEP_UNMAPPED = process.argv.includes('--keep-unmapped');

/** @param {string} raw */
function parseEnvFile(raw) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function isPlaceholder(value) {
  return /replace-with|replace-me|your-|from supabase status|<service_role/i.test(value);
}

/**
 * @param {{ sections: { title: string; keys: string[] }[]; denylist?: Set<string> }} schema
 * @param {Map<string, string>} values
 */
function renderEnv(schema, values) {
  const used = new Set();
  const lines = [];
  const denylist = schema.denylist ?? new Set();

  for (const key of [...values.keys()]) {
    if (denylist.has(key)) {
      values.delete(key);
    }
  }

  for (const section of schema.sections) {
    const entries = section.keys
      .map((key) => ({ key, value: values.get(key) }))
      .filter((e) => e.value !== undefined && e.value !== '' && !isPlaceholder(e.value));

    if (entries.length === 0) continue;

    lines.push('', `# ${section.title}`);
    for (const { key, value } of entries) {
      used.add(key);
      const needsQuotes = /[\s#"'\\]/.test(value) || value.includes(',');
      lines.push(needsQuotes ? `${key}='${value.replace(/'/g, "'\\''")}'` : `${key}=${value}`);
    }
  }

  const extras = [...values.keys()].filter((k) => !used.has(k) && !denylist.has(k)).sort();
  if (extras.length > 0) {
    if (KEEP_UNMAPPED) {
      lines.push('', '# Unused (remove)');
      for (const key of extras) {
        lines.push(`${key}=${values.get(key) ?? ''}`);
      }
    } else {
      console.warn(`  dropped ${extras.length}: ${extras.join(', ')}`);
    }
  }

  return `${lines.join('\n').replace(/^\n+/, '')}\n`;
}

let changed = 0;
for (const schema of Object.values(SCHEMAS)) {
  const abs = join(ROOT, schema.path);
  if (!existsSync(abs)) {
    console.log(`skip: ${schema.path}`);
    continue;
  }
  const before = readFileSync(abs, 'utf8');
  const values = parseEnvFile(before);
  const after = renderEnv(schema, values);
  if (before === after) {
    console.log(`ok: ${schema.path}`);
    continue;
  }
  changed += 1;
  console.log(`${DRY_RUN ? 'would update' : 'updated'}: ${schema.path}`);
  if (!DRY_RUN) writeFileSync(abs, after, 'utf8');
}

console.log(`\n${changed} file(s) ${DRY_RUN ? 'would change' : 'updated'}.`);
