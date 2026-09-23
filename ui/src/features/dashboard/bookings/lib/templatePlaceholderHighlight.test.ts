import { describe, expect, it } from 'vitest';

import { extractPlaceholderKey, isKnownTemplatePlaceholderToken, highlightPlaceholdersInHtml, TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS, TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS_PREVIEW, TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS_EDIT, TemplatePlaceholderHighlight } from '@/features/dashboard/bookings/lib/templatePlaceholderHighlight';

describe('extractPlaceholderKey', () => {

  it('extractPlaceholderKey is exported', () => {
    expect(typeof extractPlaceholderKey).toBe('function');
  });

});

describe('isKnownTemplatePlaceholderToken', () => {

  it('isKnownTemplatePlaceholderToken is exported', () => {
    expect(typeof isKnownTemplatePlaceholderToken).toBe('function');
  });

});

describe('highlightPlaceholdersInHtml', () => {

  it('highlightPlaceholdersInHtml is exported', () => {
    expect(typeof highlightPlaceholdersInHtml).toBe('function');
  });

});

describe('TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS', () => {
  it('is defined', () => {
    expect(TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS).toBeDefined();
  });
});

describe('TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS_PREVIEW', () => {
  it('is defined', () => {
    expect(TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS_PREVIEW).toBeDefined();
  });
});

describe('TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS_EDIT', () => {
  it('is defined', () => {
    expect(TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS_EDIT).toBeDefined();
  });
});

describe('TemplatePlaceholderHighlight', () => {
  it('is defined', () => {
    expect(TemplatePlaceholderHighlight).toBeDefined();
  });
});
