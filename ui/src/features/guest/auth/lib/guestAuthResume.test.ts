import { describe, expect, it } from 'vitest';

import { saveContactHostDraft, takeContactHostDraft, saveGuestAuthResume, peekGuestAuthResume, takeGuestAuthResume, hasGuestAuthResume, clearGuestAuthResume, CONTACT_HOST_DRAFT_STORAGE_KEY } from '@/features/guest/auth/lib/guestAuthResume';

describe('saveContactHostDraft', () => {

  it('saveContactHostDraft is exported', () => {
    expect(typeof saveContactHostDraft).toBe('function');
  });

});

describe('takeContactHostDraft', () => {

  it('takeContactHostDraft is exported', () => {
    expect(typeof takeContactHostDraft).toBe('function');
  });

});

describe('saveGuestAuthResume', () => {

  it('saveGuestAuthResume is exported', () => {
    expect(typeof saveGuestAuthResume).toBe('function');
  });

});

describe('peekGuestAuthResume', () => {

  it('peekGuestAuthResume is exported', () => {
    expect(typeof peekGuestAuthResume).toBe('function');
  });

});

describe('takeGuestAuthResume', () => {

  it('takeGuestAuthResume is exported', () => {
    expect(typeof takeGuestAuthResume).toBe('function');
  });

});

describe('hasGuestAuthResume', () => {

  it('hasGuestAuthResume is exported', () => {
    expect(typeof hasGuestAuthResume).toBe('function');
  });

});

describe('clearGuestAuthResume', () => {

  it('clearGuestAuthResume is exported', () => {
    expect(typeof clearGuestAuthResume).toBe('function');
  });

});

describe('CONTACT_HOST_DRAFT_STORAGE_KEY', () => {
  it('is defined', () => {
    expect(CONTACT_HOST_DRAFT_STORAGE_KEY).toBeDefined();
  });
});
