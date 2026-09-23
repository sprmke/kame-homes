import { describe, expect, it } from 'vitest';

import { classifyAntiSpamFailure, isAntiSpamFailure, antiSpamErrorMessage } from '@/lib/security/antiSpamResponse';

describe('classifyAntiSpamFailure', () => {

  it('classifyAntiSpamFailure is exported', () => {
    expect(typeof classifyAntiSpamFailure).toBe('function');
  });

});

describe('isAntiSpamFailure', () => {

  it('isAntiSpamFailure is exported', () => {
    expect(typeof isAntiSpamFailure).toBe('function');
  });

});

describe('antiSpamErrorMessage', () => {

  it('antiSpamErrorMessage is exported', () => {
    expect(typeof antiSpamErrorMessage).toBe('function');
  });

});
