import { describe, expect, it } from 'vitest';

import { formatPaymentMethodsChatText, readPropertyMapsUrl } from '@/features/dashboard/inbox/lib/inboxInsertContent';

describe('formatPaymentMethodsChatText', () => {

  it('formatPaymentMethodsChatText is exported', () => {
    expect(typeof formatPaymentMethodsChatText).toBe('function');
  });

});

describe('readPropertyMapsUrl', () => {

  it('readPropertyMapsUrl is exported', () => {
    expect(typeof readPropertyMapsUrl).toBe('function');
  });

});
