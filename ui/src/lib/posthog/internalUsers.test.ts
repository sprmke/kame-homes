import { describe, expect, it } from 'vitest';

import { isInternalUser, parseInternalEmails } from './internalUsers';

describe('parseInternalEmails', () => {
  it('handles comma, semicolon and whitespace separated lists', () => {
    const set = parseInternalEmails('A@example.com, b@example.com;c@example.com  d@example.com');
    expect([...set].sort()).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
      'd@example.com',
    ]);
  });

  it('ignores values that are not addresses', () => {
    expect(parseInternalEmails('not-an-email, @nope, ok@example.com').size).toBe(1);
    expect(parseInternalEmails(undefined).size).toBe(0);
    expect(parseInternalEmails('').size).toBe(0);
  });
});

describe('isInternalUser', () => {
  const allow = parseInternalEmails('dev@kame.example');

  it('matches case-insensitively and trims', () => {
    expect(isInternalUser('  DEV@Kame.Example ', allow)).toBe(true);
  });

  it('treats a missing email as external', () => {
    // Marking a real guest internal would delete them from every insight.
    expect(isInternalUser(null, allow)).toBe(false);
    expect(isInternalUser(undefined, allow)).toBe(false);
    expect(isInternalUser('', allow)).toBe(false);
  });

  it('treats a guest as external', () => {
    expect(isInternalUser('guest@example.com', allow)).toBe(false);
  });
});
