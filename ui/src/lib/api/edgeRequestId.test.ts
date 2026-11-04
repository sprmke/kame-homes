import { describe, expect, it } from 'vitest';

import { edgeFunctionName } from '@/lib/api/edgeRequestId';

describe('edgeFunctionName', () => {
  it('reads the function from a relative path', () => {
    expect(edgeFunctionName('/submit-form?x=1')).toBe('submit-form');
    expect(edgeFunctionName('submit-form')).toBe('submit-form');
  });

  it('reads the function from an absolute URL', () => {
    expect(edgeFunctionName('https://project.supabase.co/functions/v1/submit-form?x=1')).toBe(
      'submit-form'
    );
    expect(edgeFunctionName('https://project.supabase.co/functions/v1/get-guest-trip')).toBe(
      'get-guest-trip'
    );
  });

  it('never returns the scheme as the function', () => {
    expect(edgeFunctionName('https://example.test/')).not.toBe('https:');
  });
});
