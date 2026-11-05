#!/usr/bin/env bun
/**
 * Fill supabase/ui .env.legacy-prod.local from local sources (never prints values).
 * Plan: kamespace-01 B-07 prep — merge disk backups before asking the operator.
 *
 * Usage: bun scripts/migrate/legacy-to-mt-prod/merge-legacy-prod-env.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const ROOT = path.resolve(import.meta.dir, '../../..');
const dryRun = process.argv.includes('--dry-run');

function parseEnvFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  if (!fs.existsSync(abs)) return {};
  const out = {};
  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

function parseTemplateKeys(examplePath) {
  const abs = path.join(ROOT, examplePath);
  const keys = [];
  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

function isEmptyVal(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

const SUPABASE_SOURCES = [
  'supabase/.env.legacy-prod.local',
  '.env-backups/2026-08-27/supabase/.env.local',
  '.env-backups/2026-08-27/supabase/.env.production',
  'supabase/.env.production',
  'supabase/.env.local',
  'supabase/.env.dev.local',
];

const UI_SOURCES = [
  'ui/.env.legacy-prod.local',
  '.env-backups/2026-08-27/ui/.env.production',
  '.env-backups/2026-08-27/ui/.env.development',
  'ui/.env.production',
  'ui/.env.development',
];

function mergeKeys(templateKeys, sources, extra = {}, existingPath) {
  const existing = existingPath ? parseEnvFile(existingPath) : {};
  const merged = { ...existing, ...extra };
  const filledFrom = {};
  for (const key of templateKeys) {
    if (!isEmptyVal(existing[key])) {
      filledFrom[key] = `(existing ${existingPath})`;
      continue;
    }
    if (!isEmptyVal(merged[key]) && !isEmptyVal(extra[key])) {
      filledFrom[key] = 'legacy DB (app_settings)';
      continue;
    }
    for (const src of sources) {
      const bag = parseEnvFile(src);
      if (!isEmptyVal(bag[key])) {
        merged[key] = bag[key];
        filledFrom[key] = src;
        break;
      }
    }
  }
  // Aliases after primary pass
  if (isEmptyVal(merged.GEMINI_API_KEY)) {
    for (const src of sources) {
      const bag = parseEnvFile(src);
      const keys = bag.GEMINI_API_KEYS?.split(/[,;\s]+/).filter(Boolean);
      if (keys?.[0]) {
        merged.GEMINI_API_KEY = keys[0];
        filledFrom.GEMINI_API_KEY = `${src}:GEMINI_API_KEYS[0]`;
        break;
      }
    }
  }
  return { merged, filledFrom };
}

function writeEnvFromExample(examplePath, outPath, values) {
  const example = fs.readFileSync(path.join(ROOT, examplePath), 'utf8');
  const lines = example.split('\n').map((line) => {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!m) return line;
    const key = m[1];
    const val = values[key];
    if (isEmptyVal(val)) return `${key}=`;
    const escaped = String(val).includes('\n') ? JSON.stringify(val) : val;
    return `${key}=${escaped}`;
  });
  const body = `${lines.join('\n').replace(/\n?$/, '\n')}`;
  if (!dryRun) {
    fs.writeFileSync(path.join(ROOT, outPath), body, { mode: 0o600 });
  }
}

async function fetchGcashFromLegacyDb() {
  const local = parseEnvFile('supabase/.env.local');
  const url = local.PROD_DB_URL;
  if (!url) return {};
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const r = await client.query(
      'select gcash_name, gcash_number from public.app_settings order by updated_at desc nulls last limit 1'
    );
    const row = r.rows[0];
    if (!row) return {};
    const out = {};
    if (row.gcash_name) out.GCASH_NAME = String(row.gcash_name);
    if (row.gcash_number) out.GCASH_NUMBER = String(row.gcash_number);
    return out;
  } finally {
    await client.end().catch(() => {});
  }
}

const supKeys = parseTemplateKeys('supabase/.env.legacy-prod.example');
const dbGcash = await fetchGcashFromLegacyDb().catch((e) => {
  console.warn('legacy DB gcash fetch skipped:', e.message);
  return {};
});

const sup = mergeKeys(supKeys, SUPABASE_SOURCES, dbGcash, 'supabase/.env.legacy-prod.local');
writeEnvFromExample('supabase/.env.legacy-prod.example', 'supabase/.env.legacy-prod.local', sup.merged);

const uiKeys = parseTemplateKeys('ui/.env.legacy-prod.example');
const ui = mergeKeys(uiKeys, UI_SOURCES, {}, 'ui/.env.legacy-prod.local');
writeEnvFromExample('ui/.env.legacy-prod.example', 'ui/.env.legacy-prod.local', ui.merged);

function report(label, templateKeys, merged, filledFrom) {
  const missing = templateKeys.filter((k) => isEmptyVal(merged[k]));
  const have = templateKeys.length - missing.length;
  console.log(`\n${label}: ${have}/${templateKeys.length} keys filled`);
  if (missing.length) console.log('  still empty:', missing.join(', '));
  const newly = templateKeys.filter(
    (k) => filledFrom[k] && filledFrom[k] !== '(existing legacy-prod.local)'
  );
  if (newly.length) {
    console.log(`  newly merged from disk (${newly.length}):`);
    for (const k of newly) console.log(`    ${k} ← ${filledFrom[k]}`);
  }
}

report('supabase/.env.legacy-prod.local', supKeys, sup.merged, sup.filledFrom);
report('ui/.env.legacy-prod.local', uiKeys, ui.merged, ui.filledFrom);
if (dryRun) console.log('\n(dry-run: no files written)');
