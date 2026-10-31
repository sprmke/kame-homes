#!/usr/bin/env node
/**
 * Lists ui/src feature lib/*.ts files missing a colocated *.test.ts (or *Test.ts).
 * Usage: node scripts/dev/lib-unit-test-inventory.mjs [--json]
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const UI_SRC = path.resolve(process.cwd(), 'ui/src');

const SKIP_NAME =
  /(\.test\.ts$|Test\.ts$|\.d\.ts$|types\.ts$|mock|Mock|Api\.ts$|edgeClient\.ts$)/i;

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      await walk(full, out);
    } else if (ent.isFile() && ent.name.endsWith('.ts') && !ent.name.endsWith('.tsx')) {
      if (full.includes(`${path.sep}lib${path.sep}`) || full.includes(`${path.sep}utils${path.sep}`)) {
        out.push(full);
      }
    }
  }
  return out;
}

function hasTest(siblingBasename, filesInDir) {
  const base = siblingBasename.replace(/\.ts$/, '');
  return filesInDir.some(
    (f) =>
      f === `${base}.test.ts` ||
      f === `${base}Test.ts` ||
      f === `${base}.test.tsx`
  );
}

async function main() {
  const all = await walk(UI_SRC);
  const missing = [];

  for (const file of all) {
    if (SKIP_NAME.test(path.basename(file))) continue;
    const dir = path.dirname(file);
    const dirFiles = await readdir(dir);
    if (!hasTest(path.basename(file), dirFiles)) {
      missing.push(path.relative(process.cwd(), file));
    }
  }

  missing.sort();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ totalLibFiles: all.length, missingCount: missing.length, missing }, null, 2));
  } else {
    console.log(`Missing unit tests: ${missing.length}`);
    for (const m of missing) console.log(m);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
