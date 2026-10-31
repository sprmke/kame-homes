import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('drops falsy inputs', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b');
  });

  it('keeps typography scale tokens with color utilities', () => {
    expect(cn('text-stat-value', 'text-emerald-600')).toContain('text-stat-value');
    expect(cn('text-stat-value', 'text-emerald-600')).toContain('text-emerald-600');
  });

  it('deduplicates conflicting tailwind utilities', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
