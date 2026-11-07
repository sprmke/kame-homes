import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ACTIVE_IDENTITY_VERDICTS,
  IDENTITY_FLAG_CODES,
  IDENTITY_VERDICTS,
  identityVerdictLabel,
} from './identityVerdict';

const SERVER_SOURCE = readFileSync(
  resolve(__dirname, '../../../../../supabase/functions/_shared/identityVerification.ts'),
  'utf8'
);

/** Pull `export const NAME = [ ... ] as const;` out of the Deno source. */
function readStringArray(source: string, name: string): string[] {
  const match = source.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const;`, 's'));
  if (!match) throw new Error(`${name} not found in the server module`);
  return Array.from(match[1]!.matchAll(/'([^']+)'/g)).map((entry) => entry[1]!);
}

describe('identity verdict mirror parity', () => {
  it('mirrors the server verdict list in order', () => {
    expect(IDENTITY_VERDICTS).toEqual(readStringArray(SERVER_SOURCE, 'IDENTITY_VERDICTS'));
  });

  it('mirrors the server active-verdict list', () => {
    expect(ACTIVE_IDENTITY_VERDICTS).toEqual(
      readStringArray(SERVER_SOURCE, 'ACTIVE_IDENTITY_VERDICTS')
    );
  });

  it('mirrors the server flag catalog', () => {
    expect(IDENTITY_FLAG_CODES).toEqual(readStringArray(SERVER_SOURCE, 'IDENTITY_FLAG_CODES'));
  });

  it('never upgrades a partial verification to "Verified"', () => {
    expect(identityVerdictLabel('verified')).toBe('Verified');
    expect(identityVerdictLabel('partially_verified')).not.toBe('Verified');
    expect(identityVerdictLabel('unverified')).toBe('Needs review');
  });
});
