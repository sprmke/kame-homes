import { describe, expect, it } from 'vitest';

import { isVideoEditorV2Enabled } from '@/features/dashboard/marketing/lib/video/videoEditorFlag';

describe('isVideoEditorV2Enabled', () => {
  it('is on unless explicitly turned off', () => {
    expect(isVideoEditorV2Enabled(undefined)).toBe(true);
    expect(isVideoEditorV2Enabled('')).toBe(true);
    expect(isVideoEditorV2Enabled('true')).toBe(true);
    expect(isVideoEditorV2Enabled('false')).toBe(false);
    expect(isVideoEditorV2Enabled(' FALSE ')).toBe(false);
  });
});
