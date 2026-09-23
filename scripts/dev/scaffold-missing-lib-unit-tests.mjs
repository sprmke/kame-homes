#!/usr/bin/env node
/**
 * Scaffolds colocated Vitest files for lib modules missing tests.
 * Skips files that already have *.test.ts / *Test.ts.
 *
 * Usage:
 *   node scripts/dev/scaffold-missing-lib-unit-tests.mjs --dry-run
 *   node scripts/dev/scaffold-missing-lib-unit-tests.mjs --write
 *   node scripts/dev/scaffold-missing-lib-unit-tests.mjs --write --domain dashboard/bookings/lib
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const UI_SRC = path.resolve(process.cwd(), 'ui/src');
const SKIP_NAME =
  /(\.test\.ts$|Test\.ts$|\.d\.ts$|^types\.ts$|mock|Mock|Api\.ts$|edgeClient\.ts$|\.tsx$)/i;

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      await walk(full, out);
    } else if (ent.isFile() && ent.name.endsWith('.ts')) {
      if (full.includes(`${path.sep}lib${path.sep}`) || full.includes(`${path.sep}utils${path.sep}`)) {
        out.push(full);
      }
    }
  }
  return out;
}

function hasTest(basename, dirFiles) {
  const base = basename.replace(/\.ts$/, '');
  return dirFiles.some(
    (f) => f === `${base}.test.ts` || f === `${base}Test.ts`
  );
}

function extractExports(source) {
  const fns = [];
  const consts = [];
  for (const m of source.matchAll(/export\s+function\s+(\w+)/g)) fns.push(m[1]);
  for (const m of source.matchAll(/export\s+const\s+(\w+)/g)) consts.push(m[1]);
  return { fns, consts };
}

function toImportPath(fromFile) {
  const rel = path.relative(UI_SRC, fromFile).replace(/\\/g, '/').replace(/\.ts$/, '');
  return `@/${rel}`;
}

function buildTestFile(sourceFile, { fns, consts }) {
  const importPath = toImportPath(sourceFile);
  const importSymbols = [...new Set([...fns, ...consts])];
  const importLine =
    importSymbols.length > 0
      ? `import { ${importSymbols.join(', ')} } from '${importPath}';`
      : `import * as mod from '${importPath}';`;

  const tests = [];

  for (const name of fns) {
    tests.push(`
  it('${name} is callable', () => {
    expect(typeof ${name}).toBe('function');
  });`);
  }

  for (const name of consts) {
    tests.push(`
  it('${name} is defined', () => {
    expect(${name}).toBeDefined();
  });`);
  }

  if (importSymbols.length === 0) {
    tests.push(`
  it('loads module', () => {
    expect(mod).toBeDefined();
  });`);
  }

  return `import { describe, expect, it } from 'vitest';

${importLine}

describe('${path.basename(sourceFile).replace(/\.ts$/, '')}', () => {${tests.join('')}
});
`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const write = process.argv.includes('--write');
  const domainIdx = process.argv.indexOf('--domain');
  const domainFilter = domainIdx >= 0 ? process.argv[domainIdx + 1] : null;

  if (!dryRun && !write) {
    console.error('Pass --dry-run or --write');
    process.exit(1);
  }

  const all = await walk(UI_SRC);
  let created = 0;

  for (const file of all) {
    if (SKIP_NAME.test(path.basename(file))) continue;
    if (domainFilter && !file.includes(domainFilter.replace(/\//g, path.sep))) continue;

    const dir = path.dirname(file);
    const dirFiles = await readdir(dir);
    if (hasTest(path.basename(file), dirFiles)) continue;

    const source = await readFile(file, 'utf8');
    if (!source.includes('export ')) continue;

    const testPath = file.replace(/\.ts$/, '.test.ts');
    const content = buildTestFile(file, extractExports(source));

    if (write) {
      await writeFile(testPath, content, 'utf8');
    }
    created += 1;
    if (dryRun) console.log(`would create ${path.relative(process.cwd(), testPath)}`);
  }

  console.log(`${write ? 'Created' : 'Would create'} ${created} test file(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
