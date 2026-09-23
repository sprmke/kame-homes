import { describe, expect, it } from 'vitest';

import { canSubmitterReply, canAdminReply, ticketStatusBannerCopy, submitterReplyPlaceholder, adminReplyPlaceholder } from '@/features/dashboard/help-support/lib/supportTicketStatus';

describe('canSubmitterReply', () => {

  it('canSubmitterReply is exported', () => {
    expect(typeof canSubmitterReply).toBe('function');
  });

});

describe('canAdminReply', () => {

  it('canAdminReply is exported', () => {
    expect(typeof canAdminReply).toBe('function');
  });

});

describe('ticketStatusBannerCopy', () => {

  it('ticketStatusBannerCopy is exported', () => {
    expect(typeof ticketStatusBannerCopy).toBe('function');
  });

});

describe('submitterReplyPlaceholder', () => {

  it('submitterReplyPlaceholder is exported', () => {
    expect(typeof submitterReplyPlaceholder).toBe('function');
  });

});

describe('adminReplyPlaceholder', () => {

  it('adminReplyPlaceholder is exported', () => {
    expect(typeof adminReplyPlaceholder).toBe('function');
  });

});
