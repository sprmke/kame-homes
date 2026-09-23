#!/usr/bin/env node
/**
 * Lists lib/*.ts files whose colocated test is export-only (no behavioral expects).
 * Usage: node scripts/dev/lib-behavioral-coverage-audit.mjs [--json]
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const UI_SRC = path.resolve(process.cwd(), 'ui/src');

const MEANINGFUL =
  /expect\([^)]+\)\.(toBe|toEqual|toMatch|toThrow|toBeNull|toContain|toBeGreaterThan|toBeLessThan)\((?!['"]function['"]\))/;

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.isFile() && ent.name.endsWith('.ts') && full.includes(`${path.sep}lib${path.sep}`)) {
      if (!/\.test\.|types\.ts|Test\.ts|mock|Mock/i.test(ent.name)) out.push(full);
    }
  }
  return out;
}

function hasBranching(source) {
  return /\b(if\s*\(|switch\s*\(|return\s+[^;]+\?)/.test(source);
}

function isExportOnlyTest(content) {
  if (content.includes('describe.skip')) return false;
  return !MEANINGFUL.test(content);
}

async function main() {
  const libs = await walk(UI_SRC);
  const exportOnly = [];
  const typesOnly = [];

  for (const lib of libs) {
    const testPath = lib.replace(/\.ts$/, '.test.ts');
    let testContent;
    try {
      testContent = await readFile(testPath, 'utf8');
    } catch {
      continue;
    }
    const source = await readFile(lib, 'utf8');
    const typesOnlyModule =
      /export\s+type\s+/.test(source) && !/export\s+(function|const|class)\s+/.test(source);
    if (typesOnlyModule) {
      typesOnly.push(path.relative(process.cwd(), lib));
      continue;
    }
    if (isExportOnlyTest(testContent) && hasBranching(source)) {
      exportOnly.push(path.relative(process.cwd(), lib));
    }
  }

  exportOnly.sort();
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        { exportOnlyBranchingCount: exportOnly.length, typesOnlyCount: typesOnly.length, exportOnly },
        null,
        2
      )
    );
  } else {
    console.log(`Export-only tests (branching libs): ${exportOnly.length}`);
    console.log(`Types-only libs (skipped tests OK): ${typesOnly.length}`);
    for (const f of exportOnly.slice(0, 50)) console.log(f);
    if (exportOnly.length > 50) console.log(`… and ${exportOnly.length - 50} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
