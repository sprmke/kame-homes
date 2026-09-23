import { describe, expect, it } from 'vitest';

import { isSupportTicketDraftComplete, SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_SEVERITIES, supportTicketDraftSchema, supportTicketFormSchema } from '@/features/dashboard/help-support/lib/supportTicketSchema';

describe('isSupportTicketDraftComplete', () => {

  it('isSupportTicketDraftComplete is exported', () => {
    expect(typeof isSupportTicketDraftComplete).toBe('function');
  });

});

describe('SUPPORT_TICKET_CATEGORIES', () => {
  it('is defined', () => {
    expect(SUPPORT_TICKET_CATEGORIES).toBeDefined();
  });
});

describe('SUPPORT_TICKET_SEVERITIES', () => {
  it('is defined', () => {
    expect(SUPPORT_TICKET_SEVERITIES).toBeDefined();
  });
});

describe('supportTicketDraftSchema', () => {
  it('is defined', () => {
    expect(supportTicketDraftSchema).toBeDefined();
  });
});

describe('supportTicketFormSchema', () => {
  it('is defined', () => {
    expect(supportTicketFormSchema).toBeDefined();
  });
});
