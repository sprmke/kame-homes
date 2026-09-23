import { describe, expect, it } from 'vitest';

import { buildListingChangeDocOptions } from '@/features/dashboard/super-admin/lib/listingRequestChangesMessage';

describe('buildListingChangeDocOptions', () => {

  it('buildListingChangeDocOptions is exported', () => {
    expect(typeof buildListingChangeDocOptions).toBe('function');
  });

});
