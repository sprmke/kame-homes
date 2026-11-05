#!/usr/bin/env bun
/**
 * Seed local demo data for the AI companion conversation QA loop.
 *
 * Applies `scripts/dev/seed-ai-qa.sql` against the local stack (org `kame-home`,
 * property `monaco-2612`). Safe to re-run; tagged rows are replaced.
 *
 *   bun run seed:ai-qa
 *
 * Requires local Supabase (`./dev.sh` or `bun run start:supabase`). Does not
 * touch hosted projects.
 */
import { $ } from 'bun';
import { resolve } from 'node:path';

const sql = resolve(import.meta.dir, 'seed-ai-qa.sql');
const result =
  await $`./scripts/dev/run-with-ui-dev-env.sh ./scripts/dev/bunx --bun supabase@latest db query --local -f ${sql}`.nothrow();
if (result.exitCode !== 0) {
  console.error(result.stderr.toString() || result.stdout.toString());
  process.exit(result.exitCode ?? 1);
}
console.log(result.stdout.toString().trim() || 'seed-ai-qa: applied');
