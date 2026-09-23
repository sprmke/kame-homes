import { describe, expect, it } from 'vitest';

import { useInboxOrgScopeForUpload } from '@/features/dashboard/inbox/lib/inboxChatAttachment';

describe('useInboxOrgScopeForUpload', () => {

  it('useInboxOrgScopeForUpload is exported', () => {
    expect(typeof useInboxOrgScopeForUpload).toBe('function');
  });

});
