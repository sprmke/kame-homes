import { describe, expect, it } from 'vitest';

import { toCapitalCase, transformFieldValues } from '@/utils/text/formatters';

describe('toCapitalCase', () => {
  it('is defined', () => {
    expect(toCapitalCase).toBeDefined();
  });
});

describe('transformFieldValues', () => {
  it('is defined', () => {
    expect(transformFieldValues).toBeDefined();
  });
});
