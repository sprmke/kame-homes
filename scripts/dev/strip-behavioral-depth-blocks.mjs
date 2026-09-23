#!/usr/bin/env node
/** Removes behavioral-depth describe blocks appended by deepen-lib-unit-tests.mjs */
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

const BLOCK = /\n+describe\('[^']*\/\* behavioral-depth \*\/', \(\) => \{[\s\S]*?\n\}\);\n?/g;

async function main() {
  const files = await walk(UI_SRC);
  let stripped = 0;
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (!content.includes('behavioral-depth')) continue;
    const next = content.replace(BLOCK, '\n');
    if (next !== content) {
      await writeFile(file, next, 'utf8');
      stripped += 1;
    }
  }
  console.log(`Stripped behavioral-depth blocks from ${stripped} file(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
