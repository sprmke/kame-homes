#!/usr/bin/env node
/**
 * Blueprint (openpolotno) nests @types/react@18 as an optional peer.
 * Two copies of @types/react make tsc fail on Vercel with:
 *   Type 'import(".../@types/react").ReactNode' is not assignable to type 'React.ReactNode'
 * Delete every nested copy under package node_modules trees.
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const keep = new Set([
  join(root, 'node_modules', '@types', 'react'),
  join(root, 'node_modules', '@types', 'react-dom'),
  join(root, 'ui', 'node_modules', '@types', 'react'),
  join(root, 'ui', 'node_modules', '@types', 'react-dom'),
]);

/** @type {string[]} */
const removed = [];

/**
 * @param {string} dir
 * @param {number} depth
 */
function walk(dir, depth = 0) {
  if (depth > 20 || !existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const name of entries) {
    if (name === '.' || name === '..') continue;
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;

    if (name === '@types') {
      for (const typesPkg of ['react', 'react-dom']) {
        const typesPath = join(full, typesPkg);
        if (!existsSync(typesPath)) continue;
        if (keep.has(typesPath)) continue;
        rmSync(typesPath, { recursive: true, force: true });
        removed.push(typesPath);
      }
      continue;
    }

    if (name === 'node_modules' || name.startsWith('@') || depth === 0) {
      walk(full, depth + 1);
    } else if (existsSync(join(full, 'node_modules'))) {
      walk(join(full, 'node_modules'), depth + 1);
    }
  }
}

for (const base of [join(root, 'node_modules'), join(root, 'ui', 'node_modules')]) {
  if (existsSync(base)) walk(base, 0);
}

if (removed.length === 0) {
  console.log('dedupe-react-types: no nested @types/react copies found');
} else {
  for (const path of removed) {
    console.log(`dedupe-react-types: removed ${path.replace(root + '/', '')}`);
  }
}
