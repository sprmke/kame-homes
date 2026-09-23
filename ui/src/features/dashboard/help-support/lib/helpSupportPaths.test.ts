import { describe, expect, it } from 'vitest';

import { useHelpSupportAdminScope, useHelpSupportBasePath, helpSupportDocsPath, helpSupportTicketsPath, helpSupportNewTicketPath, helpSupportTicketDetailPath, isSupportTicketId, resolveTicketsRouteSegment, ticketsComposeSearchParam, helpSupportSectionFromPath } from '@/features/dashboard/help-support/lib/helpSupportPaths';

describe('useHelpSupportAdminScope', () => {

  it('useHelpSupportAdminScope is exported', () => {
    expect(typeof useHelpSupportAdminScope).toBe('function');
  });

});

describe('useHelpSupportBasePath', () => {

  it('useHelpSupportBasePath is exported', () => {
    expect(typeof useHelpSupportBasePath).toBe('function');
  });

});

describe('helpSupportDocsPath', () => {

  it('helpSupportDocsPath is exported', () => {
    expect(typeof helpSupportDocsPath).toBe('function');
  });

});

describe('helpSupportTicketsPath', () => {

  it('helpSupportTicketsPath is exported', () => {
    expect(typeof helpSupportTicketsPath).toBe('function');
  });

});

describe('helpSupportNewTicketPath', () => {

  it('helpSupportNewTicketPath is exported', () => {
    expect(typeof helpSupportNewTicketPath).toBe('function');
  });

});

describe('helpSupportTicketDetailPath', () => {

  it('helpSupportTicketDetailPath is exported', () => {
    expect(typeof helpSupportTicketDetailPath).toBe('function');
  });

});

describe('isSupportTicketId', () => {

  it('isSupportTicketId is exported', () => {
    expect(typeof isSupportTicketId).toBe('function');
  });

});

describe('resolveTicketsRouteSegment', () => {

  it('resolveTicketsRouteSegment is exported', () => {
    expect(typeof resolveTicketsRouteSegment).toBe('function');
  });

});

describe('ticketsComposeSearchParam', () => {

  it('ticketsComposeSearchParam is exported', () => {
    expect(typeof ticketsComposeSearchParam).toBe('function');
  });

});

describe('helpSupportSectionFromPath', () => {

  it('helpSupportSectionFromPath is exported', () => {
    expect(typeof helpSupportSectionFromPath).toBe('function');
  });

});
