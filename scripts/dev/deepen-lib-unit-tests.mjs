#!/usr/bin/env node
/**
 * Appends safe behavioral Vitest cases to export-only lib tests by reading
 * catalog keys / filter shapes from the source module.
 *
 * Usage: node scripts/dev/deepen-lib-unit-tests.mjs [--write] [--domain path/fragment]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UI_SRC = path.resolve(process.cwd(), 'ui/src');

const MEANINGFUL =
  /expect\([^)]+\)\.(toBe|toEqual|toMatch|toThrow|toBeNull|toContain|toBeGreaterThan|toBeLessThan)\((?!['"]function['"]\))/;

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

function isExportOnly(content) {
  if (content.includes('describe.skip') || content.includes('// behavioral-depth')) return false;
  return !MEANINGFUL.test(content);
}

function importPath(testFile) {
  const rel = path.relative(UI_SRC, testFile.replace(/\.test\.ts$/, '.ts')).replace(/\\/g, '/');
  return `@/${rel}`;
}

function sampleStringKeys(source) {
  const keys = new Set();
  for (const m of source.matchAll(/^\s*['"]?([a-zA-Z][\w-]*)['"]?\s*:/gm)) {
    keys.add(m[1]);
  }
  for (const m of source.matchAll(/\|\s*'([^']+)'/g)) {
    keys.add(m[1]);
  }
  return [...keys].filter((k) => !['true', 'false', 'null', 'undefined', 'string', 'number'].includes(k));
}

function exportedFunctions(source) {
  return [...source.matchAll(/export\s+function\s+(\w+)\s*\(([^)]*)\)/g)].map((m) => ({
    name: m[1],
    params: m[2].trim(),
  }));
}

function buildAppendBlocks(source, fns) {
  const blocks = [];

  for (const fn of fns) {
    const lower = fn.name.toLowerCase();
    const firstParam = fn.params.split(',')[0]?.trim() ?? '';
    // Only append tests with high-confidence signatures (permission gates).
    if (
      (lower.startsWith('has') || lower.startsWith('can')) &&
      firstParam.includes('permissions')
    ) {
      blocks.push(`describe('${fn.name} /* behavioral-depth */', () => {
  it('returns false without permissions', () => {
    expect(${fn.name}(undefined)).toBe(false);
    expect(${fn.name}([])).toBe(false);
  });
});`);
    }
  }

  return blocks;
}

async function main() {
  const write = process.argv.includes('--write');
  const domainIdx = process.argv.indexOf('--domain');
  const domain = domainIdx >= 0 ? process.argv[domainIdx + 1] : null;

  const tests = await walk(UI_SRC);
  let touched = 0;

  for (const testFile of tests) {
    if (domain && !testFile.includes(domain.replace(/\//g, path.sep))) continue;

    let content = await readFile(testFile, 'utf8');
    if (!isExportOnly(content) || content.includes('behavioral-depth')) continue;

    const libFile = testFile.replace(/\.test\.ts$/, '.ts');
    let source;
    try {
      source = await readFile(libFile, 'utf8');
    } catch {
      continue;
    }

    const fns = exportedFunctions(source);
    if (fns.length === 0) continue;

    const blocks = buildAppendBlocks(source, fns);
    if (blocks.length === 0) continue;

    const importPathStr = importPath(testFile);
    const names = fns.map((f) => f.name);
    const importLine = content.match(/^import \{[^}]+\} from/m);
    if (!importLine) continue;

    content = `${content.trim()}\n\n${blocks.join('\n\n')}\n`;
    if (write) await writeFile(testFile, content, 'utf8');
    touched += 1;
  }

  console.log(`${write ? 'Deepened' : 'Would deepen'} ${touched} test file(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
