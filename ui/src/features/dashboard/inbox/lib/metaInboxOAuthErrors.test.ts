import { describe, expect, it } from 'vitest';

import { metaInboxOAuthErrorMessage } from '@/features/dashboard/inbox/lib/metaInboxOAuthErrors';

describe('metaInboxOAuthErrorMessage', () => {

  it('metaInboxOAuthErrorMessage is exported', () => {
    expect(typeof metaInboxOAuthErrorMessage).toBe('function');
  });

});
