import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';

const SRC = resolve(import.meta.dirname, '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+63[\s-]?|0)\d{2,3}[\s-]?\d{3}[\s-]?\d{4}/;
const PLACEHOLDER_LITERAL = /placeholder=(?:"([^"]*)"|'([^']*)'|\{'([^']*)'\})/g;

/** Hardcoded email/phone placeholders in JSX, which bypass `FORM_PLACEHOLDERS`. */
export function findHardcodedContactPlaceholders(source: string): string[] {
  const hits: string[] = [];
  for (const [, double, single, jsx] of source.matchAll(PLACEHOLDER_LITERAL)) {
    const value = double ?? single ?? jsx ?? '';
    if (EMAIL.test(value) || PHONE.test(value)) hits.push(value);
  }
  return hits;
}

describe('findHardcodedContactPlaceholders', () => {
  it('flags literal contact placeholders', () => {
    expect(findHardcodedContactPlaceholders('<Input placeholder="user@gmail.com" />')).toEqual([
      'user@gmail.com',
    ]);
    expect(
      findHardcodedContactPlaceholders("<Input placeholder='+63 917 123 4567' />")
    ).toHaveLength(1);
    expect(
      findHardcodedContactPlaceholders("<Input placeholder={'Ex. 0917 123 4567'} />")
    ).toHaveLength(1);
  });

  it('ignores the shared constant and unrelated placeholders', () => {
    expect(
      findHardcodedContactPlaceholders('<Input placeholder={FORM_PLACEHOLDERS.email} />')
    ).toEqual([]);
    expect(findHardcodedContactPlaceholders('<Input placeholder="Search..." />')).toEqual([]);
    expect(findHardcodedContactPlaceholders('<Input placeholder="#000000" />')).toEqual([]);
  });
});

describe('FORM_PLACEHOLDERS', () => {
  it('is defined', () => {
    expect(FORM_PLACEHOLDERS).toBeDefined();
  });

  it('uses realistic email and PH mobile examples', () => {
    expect(FORM_PLACEHOLDERS.email).toMatch(/^[a-z]+\.[a-z]+@gmail\.com$/);
    expect(FORM_PLACEHOLDERS.phone).toMatch(/^09\d{2} \d{3} \d{4}$/);
    expect(PHONE.test(FORM_PLACEHOLDERS.phone)).toBe(true);
  });

  it('keeps the name and email examples aligned', () => {
    const name = FORM_PLACEHOLDERS.fullName.replace(/^Ex\.\s*/, '');
    const [localPart] = FORM_PLACEHOLDERS.email.split('@');
    expect(localPart.replace(/\./g, '')).toBe(name.toLowerCase().replace(/[^a-z]/g, ''));
  });

  it('has no hardcoded email or phone placeholders in JSX', () => {
    const offenders = walk(SRC)
      .flatMap((file) =>
        findHardcodedContactPlaceholders(readFileSync(file, 'utf8')).map(
          (value) => `${relative(SRC, file)}: ${value}`
        )
      )
      .sort();
    expect(offenders).toEqual([]);
  });
});
