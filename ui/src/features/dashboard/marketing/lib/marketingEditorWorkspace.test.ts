import { describe, expect, it } from 'vitest';

import { marketingEditorWorkspaceClassName } from '@/features/dashboard/marketing/lib/marketingEditorWorkspace';

describe('marketingEditorWorkspaceClassName', () => {
  it('is defined', () => {
    expect(marketingEditorWorkspaceClassName).toBeDefined();
  });
});
