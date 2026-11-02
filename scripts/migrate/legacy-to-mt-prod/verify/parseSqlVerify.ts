/**
 * parseSqlVerify.ts — read psql output from sql/90-verify.sql and exit non-zero on failures.
 *
 * Usage: bun scripts/migrate/legacy-to-mt-prod/verify/parseSqlVerify.ts <verify.log>
 */
import { readFileSync } from 'node:fs';

const logPath = process.argv[2];
if (!logPath) {
  console.error('Usage: bun parseSqlVerify.ts <verify.log>');
  process.exit(2);
}

const text = readFileSync(logPath, 'utf8');
const lines = text.split('\n');

/** psql aligned output: " V1 orphans      |        0" */
const failureRow = /^\s*(V[0-9]+[^\|]*)\|\s*(\d+)\s*$/;

const failures: string[] = [];

for (const line of lines) {
  if (line.includes('V10 finance-line-items')) {
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length >= 3) {
      failures.push(`${parts[0]}: actual=${parts[1]} expected=${parts[2]}`);
    }
    continue;
  }
  const m = line.match(failureRow);
  if (!m) continue;
  const label = m[1].trim();
  const count = Number(m[2]);
  if (!Number.isFinite(count)) continue;
  if (label.startsWith('V3 ') || label.startsWith('V4 ') || label.startsWith('V7 ')) continue;
  if (count > 0) failures.push(`${label}: ${count}`);
}

if (failures.length) {
  console.error('verify: SQL invariant failures:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('verify: SQL invariants ok');
