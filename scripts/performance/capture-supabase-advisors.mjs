#!/usr/bin/env node
/**
 * Read-only Supabase advisor snapshot (security + performance).
 *
 * Plan: docs/workflow/planned/supabase-capacity-and-operational-readiness.md
 *
 * Requires a Supabase personal access token with project read access:
 *   export SUPABASE_ACCESS_TOKEN=sbp_...
 *   export SUPABASE_PROJECT_REF=fworvijbrwpyngycotbz   # optional when linked
 *
 * Writes raw findings plus counts by level and rule name. Findings contain
 * schema metadata only; never commit the output (it is gitignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  (() => {
    try {
      return readFileSync(join(repoRoot, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
    } catch {
      return '';
    }
  })();

if (!token) {
  process.stderr.write('[supabase-advisors] SUPABASE_ACCESS_TOKEN is required\n');
  process.exit(2);
}
if (!projectRef) {
  process.stderr.write('[supabase-advisors] SUPABASE_PROJECT_REF (or a linked project) is required\n');
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir =
  process.env.SUPABASE_METRICS_DIR ?? join(repoRoot, '.artifacts', 'supabase-advisors', stamp);
mkdirSync(outDir, { recursive: true });

function summarize(lints) {
  const byLevel = {};
  const byName = {};
  for (const lint of lints) {
    byLevel[lint.level] = (byLevel[lint.level] ?? 0) + 1;
    byName[lint.name] = (byName[lint.name] ?? 0) + 1;
  }
  return {
    total: lints.length,
    byLevel,
    byName: Object.fromEntries(Object.entries(byName).sort((a, b) => b[1] - a[1])),
  };
}

const summary = { capturedAt: new Date().toISOString(), projectRef, categories: {} };

for (const category of ['security', 'performance']) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/advisors/${category}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) {
    process.stderr.write(
      `[supabase-advisors] ${category} failed (${response.status}): ${text.slice(0, 200)}\n`
    );
    summary.categories[category] = { error: `HTTP ${response.status}` };
    continue;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    summary.categories[category] = { error: 'invalid JSON' };
    continue;
  }
  const lints = Array.isArray(parsed) ? parsed : (parsed.lints ?? parsed.data ?? []);
  writeFileSync(join(outDir, `${category}.json`), `${JSON.stringify(lints, null, 2)}\n`);
  summary.categories[category] = summarize(lints);
  process.stdout.write(
    `[supabase-advisors] ${category}: ${lints.length} findings ` +
      `${JSON.stringify(summary.categories[category].byLevel)}\n`
  );
}

writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`[supabase-advisors] snapshot in ${outDir}\n`);
