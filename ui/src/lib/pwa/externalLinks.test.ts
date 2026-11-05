import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Standalone windows have no browser chrome, so an out-of-scope link must open in
 * the system browser *and* never keep a `window.opener` handle. Every new
 * `target="_blank"` link or `window.open(..., '_blank')` call is checked here
 * instead of relying on review (PWA v2 task 7.4).
 */
const SRC = join(__dirname, '../..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__snapshots__') continue;
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

describe('external link safety', () => {
  const files = sourceFiles(SRC);

  it('every target="_blank" anchor sets rel=noopener', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
        if (!/rel=/.test(match[0])) offenders.push(`${file}: ${match[0].slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every window.open(..., "_blank") passes noopener', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/window\.open\((?:(?!\n\s*\);)[\s\S])*?_blank'[\s\S]*?\)/g)) {
        if (!/noopener/.test(match[0])) offenders.push(`${file}: ${match[0].slice(0, 100)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
