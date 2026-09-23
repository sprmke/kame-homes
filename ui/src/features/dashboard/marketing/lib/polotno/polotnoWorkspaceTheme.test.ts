import { describe, expect, it } from 'vitest';

import { polotnoWorkspaceChrome } from '@/features/dashboard/marketing/lib/polotno/polotnoWorkspaceTheme';

describe('polotnoWorkspaceChrome', () => {

  it('polotnoWorkspaceChrome is exported', () => {
    expect(typeof polotnoWorkspaceChrome).toBe('function');
  });

});
