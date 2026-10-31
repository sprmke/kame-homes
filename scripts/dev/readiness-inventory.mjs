#!/usr/bin/env node
/**
 * Read-only module inventory for production-readiness Phase 3.
 *
 * Prints: feature folders, routes, edge functions, e2e specs, route guides.
 *
 *   node scripts/dev/readiness-inventory.mjs            # markdown
 *   node scripts/dev/readiness-inventory.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const json = process.argv.includes('--json');

function walk(dir, pred) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      out.push(...walk(rel, pred));
    } else if (pred(rel, e.name)) out.push(rel);
  }
  return out;
}

const guestFeatures = fs
  .readdirSync(path.join(ROOT, 'ui/src/features/guest'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
const dashFeatures = fs
  .readdirSync(path.join(ROOT, 'ui/src/features/dashboard'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const functions = fs
  .readdirSync(path.join(ROOT, 'supabase/functions'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_') && e.name !== 'tests' && e.name !== 'node_modules')
  .map((e) => e.name)
  .sort();

const e2e = walk('ui/e2e/features', (_, n) => n.endsWith('.spec.ts'));
const guides = walk('docs/guides/routes', (_, n) => n.endsWith('.md') && n !== 'README.md');
const routeFiles = walk('ui/src', (rel, n) => /routes\//.test(rel) && (n.endsWith('.tsx') || n.endsWith('.ts')));

const crons = functions.filter((f) => /-cron$/.test(f) || f.includes('webhook'));
const bucketsHint = [];
const configToml = fs.readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8');
const bucketMatches = [...configToml.matchAll(/\[storage\.buckets\.([^\]]+)\]/g)].map((m) => m[1]);

const out = {
  generated: new Date().toISOString().slice(0, 10),
  guestFeatures,
  dashFeatures,
  edgeFunctions: functions.length,
  edgeFunctionNames: functions,
  webhooksAndCrons: crons,
  e2eSpecs: e2e,
  routeGuides: guides,
  routeSourceFiles: routeFiles,
  storageBucketsInConfig: bucketMatches,
};

if (json) {
  process.stdout.write(JSON.stringify(out, null, 2));
} else {
  console.log(`# Readiness inventory (${out.generated})\n`);
  console.log(`- Guest feature folders (${guestFeatures.length}): ${guestFeatures.join(', ')}`);
  console.log(`- Dashboard feature folders (${dashFeatures.length}): ${dashFeatures.join(', ')}`);
  console.log(`- Edge functions: ${functions.length}`);
  console.log(`- Cron/webhook-named functions (${crons.length}): ${crons.join(', ')}`);
  console.log(`- E2E specs: ${e2e.length}`);
  console.log(`- Route guides: ${guides.length}`);
  console.log(`- Route source files: ${routeFiles.length}`);
  console.log(`- Storage buckets in config.toml: ${bucketMatches.join(', ') || '(none listed)'}`);
}
