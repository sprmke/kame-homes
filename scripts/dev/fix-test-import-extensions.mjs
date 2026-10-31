#!/usr/bin/env node
/** Strip erroneous `.ts` suffix from @/ imports in Vitest files. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UI_SRC = path.resolve(process.cwd(), 'ui/src');

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

async function main() {
  const files = await walk(UI_SRC);
  let fixed = 0;
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const next = content.replace(/(from\s+['"]@\/[^'"]+)\.ts(['"])/g, '$1$2');
    if (next !== content) {
      await writeFile(file, next, 'utf8');
      fixed += 1;
    }
  }
  console.log(`Fixed .ts import suffix in ${fixed} test file(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
